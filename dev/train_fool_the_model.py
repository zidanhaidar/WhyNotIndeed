"""Train the four Fool the Model classifiers on sklearn's 8x8 digits and build round pools.

pip       softmax regression
gridlock  MLP 64-32-10
monolith  MLP 64-48-10, adversarially trained against few-pixel attacks
edith      ensemble of three adversarially trained MLPs, needs confidence to be fooled
"""
import json, sys
import numpy as np
from sklearn.datasets import load_digits

OUT = sys.argv[1]
rng = np.random.default_rng(7)
d = load_digits()
X = d.data / 16.0
Y = d.target
perm = rng.permutation(len(X))
tr, te = perm[:1400], perm[1400:]
Xtr, Ytr, Xte, Yte = X[tr], Y[tr], X[te], Y[te]


def init(sizes, seed):
    r = np.random.default_rng(seed)
    return [(r.normal(0, np.sqrt(2.0 / a), (a, b)), np.zeros(b)) for a, b in zip(sizes[:-1], sizes[1:])]


def forward(P, x):
    acts = [x]
    h = x
    for i, (W, b) in enumerate(P):
        z = h @ W + b
        h = np.maximum(z, 0) if i < len(P) - 1 else z
        acts.append(h)
    return h, acts


def softmax(z):
    z = z - z.max(axis=-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)


def grads(P, x, y):
    logits, acts = forward(P, x)
    p = softmax(logits)
    g = p.copy()
    g[np.arange(len(y)), y] -= 1
    g /= len(y)
    gP = []
    for i in range(len(P) - 1, -1, -1):
        W, b = P[i]
        gP.insert(0, (acts[i].T @ g, g.sum(0)))
        g = g @ W.T
        if i > 0:
            g = g * (acts[i] > 0)
    return gP, g * len(y)  # input grad per sample (unnormalized)


def input_grad(P, x, y):
    return grads(P, x, y)[1]


def few_pixel_attack(P, x, y, k):
    """Push k pixels to 0 or 1 in the direction that raises the loss (two half steps)."""
    x = x.copy()
    for step in range(2):
        g = input_grad(P, x, y)
        tgt = (g > 0).astype(float)
        gain = g * (tgt - x)
        kk = np.maximum(1, k // 2 if step == 0 else k - k // 2)
        for i in range(len(x)):
            idx = np.argsort(-gain[i])[:kk[i]]
            x[i, idx] = tgt[i, idx]
    return x


def train(P, epochs, adv=False, lr=0.01, seed=0, wd=1e-4):
    r = np.random.default_rng(seed)
    m = [(np.zeros_like(W), np.zeros_like(b)) for W, b in P]
    v = [(np.zeros_like(W), np.zeros_like(b)) for W, b in P]
    t = 0
    for ep in range(epochs):
        order = r.permutation(len(Xtr))
        for s in range(0, len(order), 64):
            bi = order[s:s + 64]
            xb, yb = Xtr[bi], Ytr[bi]
            xb = np.clip(xb + r.normal(0, 0.05, xb.shape), 0, 1)
            if adv and ep >= 3:
                k = r.integers(1, 11, len(xb))
                xa = few_pixel_attack(P, xb, yb, k)
                xb = np.concatenate([xb, xa])
                yb = np.concatenate([yb, yb])
            gP, _ = grads(P, xb, yb)
            t += 1
            for i, ((W, b), (gW, gb)) in enumerate(zip(P, gP)):
                gW = gW + wd * W
                mW, mb = m[i]; vW, vb = v[i]
                mW = 0.9 * mW + 0.1 * gW; mb = 0.9 * mb + 0.1 * gb
                vW = 0.999 * vW + 0.001 * gW ** 2; vb = 0.999 * vb + 0.001 * gb ** 2
                m[i] = (mW, mb); v[i] = (vW, vb)
                c1, c2 = 1 - 0.9 ** t, 1 - 0.999 ** t
                P[i] = (W - lr * (mW / c1) / (np.sqrt(vW / c2) + 1e-8), b - lr * (mb / c1) / (np.sqrt(vb / c2) + 1e-8))
    return P


def predict(models, x):
    return np.mean([softmax(forward(P, x)[0]) for P in models], axis=0)


def acc(models, x, y):
    return (predict(models, x).argmax(1) == y).mean()


models = {}
models['pip'] = [train(init([64, 10], 1), 30, lr=0.02)]
models['gridlock'] = [train(init([64, 32, 10], 2), 40)]
models['monolith'] = [train(init([64, 48, 10], 3), 50, adv=True)]
models['edith'] = [train(init([64, 48, 10], 10 + s), 50, adv=True, seed=s) for s in range(3)]
for k, ms in models.items():
    print(k, 'test acc', round(acc(ms, Xte, Yte), 4))

VALUES = np.array([0.0, 0.5, 1.0])


def greedy_attack(ms, x0, y, target, conf, maxk):
    """Change one pixel at a time to 0, 8/16 or 16/16, picking the change that helps most. Returns pixel count or None."""
    x = x0.copy()
    changed = set()
    for _ in range(maxk * 2 + 4):
        p = predict(ms, x[None])[0]
        if target is None:
            if p.argmax() != y and p.max() >= conf:
                return len(changed), x
        elif p.argmax() == target and p[target] >= conf:
            return len(changed), x
        if len(changed) >= maxk:
            break
        cands = []
        for i in range(64):
            for v in VALUES:
                if abs(x[i] - v) < 1e-9:
                    continue
                if i not in changed and len(changed) >= maxk:
                    continue
                xc = x.copy(); xc[i] = v
                cands.append((i, v, xc))
        if not cands:
            break
        batch = np.array([c[2] for c in cands])
        pb = predict(ms, batch)
        if target is None:
            other = pb.copy(); other[:, y] = -1
            score = other.max(1) - pb[:, y]
        else:
            other = pb.copy(); other[:, target] = -1
            score = pb[:, target] - other.max(1)
        # prefer re-using pixels already changed when it is nearly as good
        bonus = np.array([0.02 if c[0] in changed else 0 for c in cands])
        j = int(np.argmax(score + bonus))
        i, v, xc = cands[j]
        x = xc
        if abs(x0[i] - v) < 1e-9:
            changed.discard(i)
        else:
            changed.add(i)
    return None, None


LEVELS = {
    'pip': dict(targeted=False, conf=0.0, budget=6),
    'gridlock': dict(targeted=True, conf=0.0, budget=7),
    'monolith': dict(targeted=True, conf=0.0, budget=9),
    'edith': dict(targeted=True, conf=0.7, budget=8),
}

pools = {}
for lvl, cfg in LEVELS.items():
    ms = models[lvl]
    p = predict(ms, Xte)
    ok = np.where((p.argmax(1) == Yte) & (p.max(1) > 0.9))[0]
    r = np.random.default_rng(100)
    r.shuffle(ok)
    counts, pool = [], []
    tried = 0
    for i in ok:
        if len(pool) >= 36 or tried >= 160:
            break
        tried += 1
        x0 = np.round(Xte[i] * 16) / 16
        y = int(Yte[i])
        if cfg['targeted']:
            targets = [t for t in range(10) if t != y]
            r.shuffle(targets)
            found = False
            for t in targets[:4]:
                n, _ = greedy_attack(ms, x0, y, t, cfg['conf'], 14)
                counts.append(n if n is not None else 99)
                if n is not None and n <= cfg['budget']:
                    pool.append({'img': [int(v) for v in np.round(x0 * 16)], 'y': y, 't': t, 'par': n})
                    found = True
                    break
        else:
            n, _ = greedy_attack(ms, x0, y, None, cfg['conf'], 14)
            counts.append(n if n is not None else 99)
            if n is not None and n <= cfg['budget']:
                pool.append({'img': [int(v) for v in np.round(x0 * 16)], 'y': y, 't': None, 'par': n})
    c = np.array(counts)
    print(lvl, 'attempts', len(c), 'greedy pixels median', np.median(c), 'p25', np.percentile(c, 25), 'p75', np.percentile(c, 75),
          'within budget', round((c <= cfg['budget']).mean(), 2), 'pool', len(pool),
          'par dist', np.bincount([q['par'] for q in pool]).tolist())
    pools[lvl] = pool


def export(ms):
    return [{'layers': [{'W': np.round(W, 4).T.tolist(), 'b': np.round(b, 4).tolist()} for W, b in P]} for P in ms]


data = {'models': {k: export(v) for k, v in models.items()},
        'levels': LEVELS,
        'rounds': pools}
with open(OUT, 'w') as f:
    f.write(json.dumps(data, separators=(',', ':')))
print('wrote', OUT)

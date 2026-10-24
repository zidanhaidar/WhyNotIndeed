/* WNI account page: log in (email or username, plus password), sign up (username, email, password), and your best runs. */
export function mount() {
  var A = window.Arcade, AC = A.account;
  var sc = A.scope();
  var main = document.getElementById('main');
  var params = new URLSearchParams(window.location.search);

  sc.add(A.siteBar(document.getElementById('bar'), {
    title: 'Your account',
    links: [{ href: '/leaderboard', icon: 'ranks', label: 'Leaderboard' }]
  }));

  // Only same-site paths are followed after logging in.
  function nextUrl() {
    var n = params.get('next') || '';
    if (!/^\/(?!\/)/.test(n) || n.indexOf('\\') >= 0 || /\/account\//.test(n)) return null;
    return n;
  }

  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }

  // ---------- log in and sign up ----------

  function renderAuth(mode) {
    var faces = A.LEVELS.map(function (L, i) { return '<span>' + A.face(L.id, ['happy', 'smug', 'calm', 'happy'][i]) + '</span>'; }).join('');
    main.innerHTML =
      '<section class="auth">' +
      '<div class="auth-pitch"><h2>Get on the board.</h2>' +
      '<p>Make an account and every run you finish goes onto the WNI leaderboard. Fourteen games, one ranking, bragging rights included.</p>' +
      '<p>Beating Edith is worth five times as much as beating Pip.</p>' +
      '<div class="auth-faces" aria-hidden="true">' + faces + '</div></div>' +
      '<div class="auth-card sticker">' +
      '<div class="auth-tabs" role="tablist">' +
      '<button type="button" class="auth-tab" role="tab" data-mode="login">Log in</button>' +
      '<button type="button" class="auth-tab" role="tab" data-mode="signup">Sign up</button></div>' +
      '<form id="auth-form" novalidate></form></div></section>';
    main.querySelectorAll('.auth-tab').forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.mode); }); });
    show(mode === 'signup' ? 'signup' : 'login');
  }

  function field(name, label, type, auto, hint) {
    return '<div class="field" data-field="' + name + '"><label for="f-' + name + '">' + label + '</label>' +
      '<div class="input-wrap"><input id="f-' + name + '" name="' + name + '" type="' + type + '" autocomplete="' + auto + '"' +
      (name === 'username' ? ' maxlength="20" spellcheck="false" autocapitalize="off"' : '') + (name === 'email' || name === 'login' ? ' maxlength="254" spellcheck="false" autocapitalize="off"' : '') +
      (type === 'password' ? ' maxlength="128"' : '') + ' required>' +
      (type === 'password' ? '<button type="button" class="peek" aria-label="Show password">Show</button>' : '') + '</div>' +
      (hint ? '<span class="hint">' + hint + '</span>' : '') + '<span class="err" aria-live="polite"></span></div>';
  }

  function show(mode) {
    main.querySelectorAll('.auth-tab').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.mode === mode)); });
    var form = document.getElementById('auth-form');
    form.dataset.mode = mode;
    form.innerHTML = (mode === 'signup'
      ? field('username', 'Username', 'text', 'username', '3 to 20 letters, numbers or underscores. Shown on the leaderboard.') +
        field('email', 'Email', 'email', 'email') +
        field('password', 'Password', 'password', 'new-password', 'At least 8 characters.')
      : field('login', 'Email or username', 'text', 'username') +
        field('password', 'Password', 'password', 'current-password')) +
      '<p class="form-msg" role="alert"></p>' +
      '<button type="submit" class="btn-ink">' + (mode === 'signup' ? 'Create my account' : 'Log in') + '</button>' +
      '<p class="auth-switch">' + (mode === 'signup' ? 'Already have an account? <button type="button" data-go="login">Log in</button>'
        : 'New here? <button type="button" data-go="signup">Make an account</button>') + '</p>';
    form.querySelector('[data-go]').addEventListener('click', function (e) { show(e.target.dataset.go); });
    form.querySelectorAll('.peek').forEach(function (b) {
      b.addEventListener('click', function () {
        var input = b.parentNode.querySelector('input');
        var hidden = input.type === 'password';
        input.type = hidden ? 'text' : 'password';
        input.classList.toggle('has-peek', hidden);
        b.textContent = hidden ? 'Hide' : 'Show';
        b.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
      });
    });
    form.querySelectorAll('input').forEach(function (i) { i.addEventListener('input', function () { setErr(i.name, ''); }); });
    form.onsubmit = function (e) { e.preventDefault(); submit(form); };
    var first = form.querySelector('input');
    if (first) first.focus();
    history.replaceState(null, '', '?' + (mode === 'signup' ? 'mode=signup&' : '') + (params.get('next') ? 'next=' + encodeURIComponent(params.get('next')) : ''));
  }

  function setErr(name, msg) {
    var f = main.querySelector('[data-field="' + name + '"]');
    if (!f) return;
    f.classList.toggle('bad', !!msg);
    f.querySelector('.err').textContent = msg || '';
    f.querySelector('input').setAttribute('aria-invalid', String(!!msg));
  }

  function validate(mode, v) {
    var bad = {};
    if (mode === 'signup' && !/^[A-Za-z0-9_]{3,20}$/.test(v.username)) bad.username = 'Use 3 to 20 letters, numbers or underscores.';
    if (mode === 'signup' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) bad.email = 'That email address does not look right.';
    if (mode === 'login') {
      if (!v.login) bad.login = 'Enter your email or username.';
      else if (v.login.indexOf('@') >= 0 ? !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.login) : !/^[A-Za-z0-9_]{3,20}$/.test(v.login)) {
        bad.login = v.login.indexOf('@') >= 0 ? 'That email address does not look right.' : 'Usernames are 3 to 20 letters, numbers or underscores.';
      }
    }
    if (mode === 'signup' && v.password.length < 8) bad.password = 'Passwords need at least 8 characters.';
    if (mode === 'login' && !v.password) bad.password = 'Enter your password.';
    return bad;
  }

  function submit(form) {
    var mode = form.dataset.mode;
    var v = {
      username: form.username ? form.username.value.trim() : '',
      email: form.email ? form.email.value.trim() : '',
      login: form.login ? form.login.value.trim() : '',
      password: form.password.value
    };
    var msg = form.querySelector('.form-msg');
    msg.textContent = '';
    var bad = validate(mode, v);
    Object.keys(bad).forEach(function (k) { setErr(k, bad[k]); });
    if (Object.keys(bad).length) { A.jingle('bad'); form.querySelector('.bad input').focus(); return; }
    var btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = mode === 'signup' ? 'Creating your account...' : 'Logging in...';
    var call = mode === 'signup' ? AC.signup(v.username, v.email, v.password) : AC.login(v.login, v.password);
    call.then(function (r) {
      if (!sc.alive()) return;
      if (!r.ok) {
        btn.disabled = false;
        btn.textContent = mode === 'signup' ? 'Create my account' : 'Log in';
        A.jingle('bad');
        if (r.data && r.data.field) { setErr(r.data.field, r.data.error); main.querySelector('[data-field="' + r.data.field + '"] input').focus(); }
        else msg.textContent = (r.data && r.data.error) || 'Something went wrong. Try again.';
        return;
      }
      A.jingle('win');
      A.toast(mode === 'signup' ? 'Welcome to WNI, ' + r.data.user.username + '!' : 'Welcome back, ' + r.data.user.username + '!', { kind: 'good' });
      AC.flushPending().then(function (saved) {
        if (!sc.alive()) return;
        if (saved) {
          var g = A.GAME_MAP[saved.game];
          A.toast('Your last run is on the board: ' + fmt(saved.score) + ' points in ' + (g ? g.name : 'a game') + ', rank #' + saved.rank + '.',
            { kind: 'good', action: { label: 'Ranks', href: '/leaderboard?game=' + encodeURIComponent(saved.game) } });
        }
        var next = nextUrl();
        if (next) sc.timeout(function () { A.go(next); }, saved ? 1600 : 700);
        else renderProfile();
      });
    });
  }

  // ---------- profile ----------

  function renderProfile() {
    var u = AC.user();
    if (!u) return renderAuth('login');
    main.innerHTML = '<p class="loading">Loading your best runs...</p>';
    AC.myScores().then(function (r) {
      if (!sc.alive()) return;
      if (r.status === 401) return renderAuth('login');
      var games = (r.ok && r.data.games) || [];
      var by = {};
      games.forEach(function (g) { by[g.game] = g; });
      var total = games.reduce(function (a, g) { return a + g.score; }, 0);
      var since = new Date(u.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      main.innerHTML =
        '<section class="profile">' +
        '<div class="me-card sticker"><div class="me-ava" style="--ava:' + AC.avatarColor(u.username) + '">' + A.esc(u.username.charAt(0).toUpperCase()) + '</div>' +
        '<h2 class="me-name">' + A.esc(u.username) + '</h2><p class="me-mail">' + A.esc(u.email) + '</p>' +
        (u.createdAt ? '<p class="me-since">Playing since ' + since + '</p>' : '<p class="me-since"></p>') +
        '<div class="me-total"><b>' + fmt(total) + '</b><span>points across ' + games.length + ' of ' + A.GAMES.length + ' games</span></div>' +
        '<button type="button" class="btn-plain" id="btn-logout">Log out</button></div>' +
        '<div class="bests"><h2>Your best runs</h2><div class="best-grid">' +
        A.GAMES.map(function (g) {
          var b = by[g.id], L = b && A.LEVEL_MAP[b.level];
          return b
            ? '<a class="best" style="--g:' + g.color + '" href="/leaderboard?game=' + g.id + '"><span class="best-name">' + A.esc(g.name) + '</span>' +
              '<span class="best-score">' + fmt(b.score) + '</span><span class="best-meta">Rank #' + b.rank + ' · vs ' + (L ? L.name : b.level) + ' · ' + b.plays + ' run' + (b.plays === 1 ? '' : 's') + '</span>' +
              '<span class="best-meta">' + A.esc(b.detail || '') + '</span></a>'
            : '<a class="best empty" style="--g:' + g.color + '" href="' + g.path + '"><span class="best-name">' + A.esc(g.name) + '</span>' +
              '<span class="best-score">No runs yet</span><span class="best-meta">Play it to get on the board</span></a>';
        }).join('') + '</div></div></section>';
      document.getElementById('btn-logout').addEventListener('click', function () {
        AC.logout().then(function () {
          if (!sc.alive()) return;
          A.toast('Logged out. Your scores stay on the board.', { kind: 'info' });
          renderAuth('login');
        });
      });
    });
  }

  // ---------- start ----------

  AC.refresh().then(function (u) {
    if (!sc.alive()) return;
    if (AC.status() === 'unreachable') {
      main.innerHTML = '<div class="note">The WNI server is not answering right now. Check that it is running, then reload this page.</div>';
      return;
    }
    if (u) renderProfile(); else renderAuth(params.get('mode'));
  });
  return sc.dispose;
}

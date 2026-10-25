"""Regression check: opens the lobby, the site pages and every game at every level in headless Chromium,
plays a little, and reports any page error. Screenshots go to dev/out/.

Usage (WNI must be running, for example with docker compose):
  python dev/check_all_games.py                       # http://localhost:8080/
  WNI_BASE=https://example.org/ python dev/check_all_games.py
Needs: pip install playwright && playwright install chromium
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
(Path(__file__).resolve().parent / 'out').mkdir(exist_ok=True)
OUT = str(Path(__file__).resolve().parent / 'out' / 'full_')
BASE = os.environ.get('WNI_BASE') or 'http://localhost:8080/'
LEVELS = ['pip', 'gridlock', 'monolith', 'edith']
GAMES = ['bury-the-bot', 'fool-the-model', 'excel-dungeon',
         'sock-trap', 'spot-kick', 'sneaky-hangman', 'herd-instinct', 'coffee-spill', 'copycat', 'echo',
         'going-up', 'cable-spaghetti', 'dont-click-that', 'badge-check']
errs = []


def watch(pg, tag):
    pg.on('pageerror', lambda e: errs.append(f'[{tag}] pageerror: {e}'))
    pg.on('console', lambda m: errs.append(f'[{tag}] console: {m.text}') if m.type == 'error' and 'TUNNEL' not in m.text and 'fonts' not in m.text and '401' not in m.text else None)


def close_help(pg):
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(80)


def level(pg, lv):
    # switch opponent; if the game asks first (WNI confirm), say yes
    pg.click(f'.lvl[data-level="{lv}"]'); pg.wait_for_timeout(120)
    if pg.evaluate('!!document.querySelector(".arcade-modal:not([hidden]) .arcade-ask")'):
        pg.click('.arcade-sheet .arcade-btn.main'); pg.wait_for_timeout(120)


def wait_until(pg, js, timeout=10000):
    # polls with evaluate: the server's security policy blocks string eval, which Playwright's built-in waiter needs
    waited = 0
    while not pg.evaluate(js):
        pg.wait_for_timeout(50)
        waited += 50
        if waited > timeout:
            raise TimeoutError('timed out waiting for ' + js)


def check(cond, msg):
    if not cond:
        errs.append('CHECK FAILED: ' + msg)


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1366, 'height': 768})
    # WNI never uses native browser dialogs; any that appear are a failure
    ctx.on('dialog', lambda d: (errs.append('native dialog appeared: ' + d.message), d.dismiss()))
    pg = ctx.new_page()
    watch(pg, 'all')

    # ---- lobby ----
    pg.goto(BASE); pg.wait_for_timeout(500)
    cards = pg.evaluate('document.querySelectorAll(".gcard").length')
    print('lobby cards:', cards)
    check(cards == 16, 'lobby should show 14 games plus the leaderboard and account cards')
    check(pg.evaluate('document.querySelectorAll("#cards .gcard").length') == 14 and pg.evaluate('document.querySelectorAll(".board-row #site-cards .gcard").length') == 2,
          'the leaderboard and account cards sit in their own section, apart from the games')
    check(pg.evaluate('document.querySelectorAll("#cards .key").length') == 10, 'number-key badges on the first ten games only')
    pg.screenshot(path=OUT + 'lobby.png', full_page=True)
    for i, g in enumerate(GAMES):
        href = pg.evaluate(f'document.querySelectorAll(".gcard")[{i}].getAttribute("href")')
        check(href == '/' + g, f'lobby card {i} links to {href}')

    # ---- music and the panic button ----
    pg.click('#btn-music'); pg.wait_for_timeout(400)
    print('music playing after click:', pg.evaluate('window.Arcade.music.playing()'))
    check(pg.evaluate('window.Arcade.music.playing()'), 'music should start from the Music button')
    pg.keyboard.press('b'); pg.wait_for_timeout(150)
    check(not pg.evaluate('window.Arcade.music.playing()'), 'the panic button should stop the music')
    check(pg.title() == 'FY27_budget_draft_v3.xlsx', 'panic title')
    pg.keyboard.press('b'); pg.wait_for_timeout(300)
    check(pg.evaluate('window.Arcade.music.playing()'), 'music should come back after the panic screen')
    pg.keyboard.press('m'); pg.wait_for_timeout(100)
    check(not pg.evaluate('window.Arcade.music.playing()'), 'M should turn the music off')

    # ---- site pages ----
    for page in ['leaderboard', 'account']:
        pg.goto(BASE + page); pg.wait_for_timeout(700)
        pg.screenshot(path=OUT + page + '.png', full_page=True)
        print(page, 'loaded:', pg.evaluate('document.querySelector("main").textContent.trim().slice(0, 60)'))

    # ---- credits: names no software (the stack is confidential) and the cards stack without gaps ----
    pg.goto(BASE + 'credits'); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT + 'credits.png', full_page=True)
    text = pg.evaluate('document.querySelector("main").textContent').lower()
    for word in ['next.js', 'react', 'postgres', 'node.js', 'docker', 'software']:
        check(word not in text, f'credits page names "{word}"')
    gap = pg.evaluate('''(() => {
        const r = [...document.querySelectorAll('.credit-card')].map((e) => e.getBoundingClientRect());
        let worst = 0;
        for (const a of r) {
            const above = r.filter((c) => Math.abs(c.left - a.left) < 2 && c.bottom <= a.top + 1);
            if (above.length) worst = Math.max(worst, a.top - Math.max(...above.map((c) => c.bottom)));
        }
        return Math.round(worst);
    })()''')
    check(gap <= 40, f'credit cards leave a {gap}px gap under the card above')
    print('credits loaded, biggest gap between cards:', gap, 'px')

    # ---- Bury the Bot (plus the WNI confirm instead of a native one) ----
    pg.goto(BASE + 'bury-the-bot'); pg.wait_for_timeout(400)
    close_help(pg)
    for lv in LEVELS:
        pg.click(f'.lvl[data-level="{lv}"]'); pg.wait_for_timeout(120)
    pg.evaluate("window.buryTheBot.state.speed = 'instant'")
    for n in range(5):
        pg.keyboard.press('1'); wait_until(pg, 'window.buryTheBot.state.phase !== "anim"')
    pg.click('.lvl[data-level="pip"]'); pg.wait_for_timeout(200)
    ask = pg.evaluate('!!document.querySelector(".arcade-modal:not([hidden]) .arcade-ask")')
    print('bury: switching mid-game shows a WNI confirm:', ask)
    check(ask, 'switching level mid-game should ask with the WNI confirm')
    pg.click('.arcade-sheet .arcade-btn.main'); pg.wait_for_timeout(200)
    check(pg.evaluate('window.buryTheBot.state.botId') == 'pip', 'confirming should switch the level')
    pg.click('#btn-new'); pg.wait_for_timeout(100)
    pg.screenshot(path=OUT + 'bury.png')

    # ---- Fool the Model ----
    pg.goto(BASE + 'fool-the-model'); pg.wait_for_timeout(300)
    close_help(pg)
    for lv in LEVELS:
        pg.click(f'.lvl[data-level="{lv}"]'); pg.wait_for_timeout(150)
        pg.click('.px[data-i="27"]'); pg.click('.px[data-i="36"]')
    print('ftm reads:', pg.evaluate('document.querySelector("#read-digit").textContent'))

    # ---- Excel Dungeon ----
    pg.goto(BASE + 'excel-dungeon'); pg.wait_for_timeout(300)
    close_help(pg)
    for lv in LEVELS:
        pg.click(f'.lvl[data-level="{lv}"]'); pg.wait_for_timeout(120)
        for k in ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft']:
            pg.keyboard.press(k)
    print('xd turn:', pg.evaluate('window.excelDungeon.state.game.turn'))

    # ---- Sock Trap ----
    pg.goto(BASE + 'sock-trap'); pg.wait_for_timeout(300)
    close_help(pg)
    for lv in LEVELS:
        level(pg, lv)
        placed = pg.evaluate('(() => { const g = window.sockTrap.state.game; let n = 0; for (let y = 1; y < 11; y++) for (let x = 1; x < 17; x++) if (n < 2 && g.place(x, y, "sock")) n++; return n; })()')
        check(placed == 2, f'sock trap {lv}: placing socks')
    pg.evaluate("window.sockTrap.state.speed = 'fast'")
    pg.keyboard.press('Enter'); pg.wait_for_timeout(1500)
    t1 = pg.evaluate('window.sockTrap.state.game.t')
    pg.keyboard.press('b'); pg.wait_for_timeout(100)
    t2 = pg.evaluate('window.sockTrap.state.game.t'); pg.wait_for_timeout(700)
    check(t1 > 5 and pg.evaluate('window.sockTrap.state.game.t') == t2, 'sock trap runs, and pauses under the panic screen')
    pg.keyboard.press('b')
    print('sock trap ticks:', t1)
    pg.screenshot(path=OUT + 'sock_trap.png')
    # a match is five offices, each with its own freshly generated floor plan
    plans = set()
    for r in range(5):
        plans.add(pg.evaluate('window.sockTrap.state.game.map.join("/")'))
        pg.evaluate('window.sockTrap.fastForward()')
        wait_until(pg, '!!document.querySelector(".arcade-modal:not([hidden]) .arcade-sheet h2")')
        title = pg.evaluate('document.querySelector(".arcade-sheet h2").textContent')
        if r < 4:
            check(title.startswith(f'Office {r + 1} of 5'), f'sock trap: office {r + 1} ends with a round summary ({title})')
            pg.click('.arcade-sheet .arcade-btn.main'); pg.wait_for_timeout(250)
    check(len(plans) == 5, f'sock trap: every office in a match has its own floor plan ({len(plans)} different)')
    check(pg.evaluate('window.sockTrap.state.match.results.length') == 5 and title in ('Squeaky clean.', 'Match won!', 'Edith gave up!'), f'sock trap: the match ends after five offices ({title})')
    print('sock trap match:', pg.evaluate('window.sockTrap.state.match.results.map((r) => r.pct + (r.won ? "% won" : "% lost")).join(", ")'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)

    # ---- Spot Kick ----
    pg.goto(BASE + 'spot-kick'); pg.wait_for_timeout(300)
    close_help(pg)
    for lv in LEVELS:
        pg.click(f'.lvl[data-level="{lv}"]'); pg.wait_for_timeout(150)
    pg.keyboard.press('a'); pg.wait_for_timeout(400); pg.keyboard.press('Space'); pg.wait_for_timeout(2300)
    print('spot kick phase after your kick:', pg.evaluate('window.spotKick.state.phase'))
    check(pg.evaluate('window.spotKick.state.phase') == 'dive', 'after your kick the robot should step up')
    pg.keyboard.press('d'); pg.wait_for_timeout(2300)
    check(pg.evaluate('window.spotKick.state.match.kicks.length') == 2, 'two kicks taken')
    pg.screenshot(path=OUT + 'spot_kick.png')

    # ---- Sneaky Hangman ----
    pg.goto(BASE + 'sneaky-hangman'); pg.wait_for_timeout(300)
    close_help(pg)
    for lv in LEVELS:
        pg.click(f'.lvl[data-level="{lv}"]'); pg.wait_for_timeout(150)
    wait_until(pg, '!!window.sneakyHangman.state.round', 20000)
    print('hangman words from:', pg.evaluate('window.sneakyHangman.state.source.provider'), pg.evaluate('window.sneakyHangman.state.source.words.length'))
    for i in range(3):
        wait_until(pg, '!!window.sneakyHangman.state.round.pending && !window.sneakyHangman.state.busy')
        pg.keyboard.press('1')
    print('hangman guesses:', pg.evaluate('window.sneakyHangman.state.round.guessed.join("")'))
    pg.screenshot(path=OUT + 'sneaky_hangman.png')

    # ---- Herd Instinct ----
    pg.goto(BASE + 'herd-instinct'); pg.wait_for_timeout(300)
    close_help(pg)
    pg.click('.lvl[data-level="edith"]'); pg.wait_for_timeout(150)
    pg.keyboard.press('Enter')
    pg.keyboard.down('ArrowRight'); pg.wait_for_timeout(1200); pg.keyboard.up('ArrowRight')
    pg.keyboard.press('b'); pg.wait_for_timeout(100)
    t1 = pg.evaluate('window.herdInstinct.state.world.t'); pg.wait_for_timeout(600)
    check(t1 > 0.5 and pg.evaluate('window.herdInstinct.state.world.t') == t1, 'herd instinct runs, and pauses under the panic screen')
    pg.keyboard.press('b')
    pg.screenshot(path=OUT + 'herd_instinct.png')

    # ---- Coffee Spill ----
    pg.goto(BASE + 'coffee-spill'); pg.wait_for_timeout(300)
    close_help(pg)
    for lv in LEVELS:
        pg.click(f'.lvl[data-level="{lv}"]'); pg.wait_for_timeout(120)
    box = pg.evaluate('(() => { const r = document.querySelector("#desk").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()')
    pg.mouse.move(box[0] + box[2] * 0.3, box[1] + box[3] * 0.7); pg.mouse.down()
    pg.mouse.move(box[0] + box[2] * 0.7, box[1] + box[3] * 0.7, steps=12); pg.mouse.up()
    used = pg.evaluate('window.coffeeSpill.state.desk.inkUsed()')
    check(used > 20, 'drawing with the pen uses ink')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(1500)
    pg.keyboard.press('b'); pg.wait_for_timeout(100)
    t1 = pg.evaluate('window.coffeeSpill.state.desk.t'); pg.wait_for_timeout(600)
    check(t1 > 10 and pg.evaluate('window.coffeeSpill.state.desk.t') == t1, 'coffee spill pours, and pauses under the panic screen')
    pg.keyboard.press('b')
    print('coffee spill ink used:', used, 'ticks:', t1)
    pg.screenshot(path=OUT + 'coffee_spill.png')

    # ---- Copycat ----
    pg.goto(BASE + 'copycat'); pg.wait_for_timeout(400)
    close_help(pg)
    for lv in LEVELS:
        level(pg, lv)
        for k in ['ArrowUp', 'ArrowRight', 'ArrowRight', 'Space', 'ArrowDown', 'ArrowLeft']:
            pg.keyboard.press(k); pg.wait_for_timeout(420 if k != 'Space' else 900)
        st = pg.evaluate('(() => { const g = window.copycat.state.game; return { turn: g.turn, n: g.count(), bot: g.botMoves.length }; })()')
        check(st['turn'] == 6 and st['bot'] == 6, f'copycat {lv}: six beats danced ({st})')
    print('copycat edith after 6 beats:', st)
    pg.screenshot(path=OUT + 'copycat.png')

    # ---- Echo ----
    pg.goto(BASE + 'echo'); pg.wait_for_timeout(400)
    close_help(pg)
    for lv in LEVELS:
        level(pg, lv)
        pg.keyboard.press('Space'); pg.wait_for_timeout(200)
        for k in ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight']:
            pg.keyboard.press(k); pg.wait_for_timeout(60)
        st = pg.evaluate('(() => { const m = window.echoGame.state.maze; return { moves: m.moves, pings: m.pingsLeft, of: m.cfg.pings, heard: Object.keys(m.memory).length }; })()')
        check(st['moves'] == 5 and st['pings'] == st['of'] - 1 and st['heard'] > 0, f'echo {lv}: moves and a ping ({st})')
    pg.keyboard.press('Space'); pg.wait_for_timeout(500)
    print('echo edith:', st)
    pg.screenshot(path=OUT + 'echo.png')

    # ---- Going Up ----
    pg.goto(BASE + 'going-up'); pg.wait_for_timeout(400)
    close_help(pg)
    for lv in LEVELS:
        pg.click(f'.lvl[data-level="{lv}"]'); pg.wait_for_timeout(120)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    pg.keyboard.press('3'); pg.click('.lift-btn[data-floor="1"]'); pg.wait_for_timeout(2500)
    st = pg.evaluate('(() => { const b = window.goingUp.state.b; return { t: b.t, y: b.you.y, stops: b.you.stops.slice(), floors: b.floors }; })()')
    check(st['t'] > 2 and st['y'] > 0, f'going up: the shift runs and the car moves ({st})')
    pg.keyboard.press('b'); pg.wait_for_timeout(100)
    t1 = pg.evaluate('window.goingUp.state.b.t'); pg.wait_for_timeout(600)
    check(pg.evaluate('window.goingUp.state.b.t') == t1, 'going up pauses under the panic screen')
    pg.keyboard.press('b'); pg.wait_for_timeout(100)
    pg.screenshot(path=OUT + 'going_up.png')
    pg.evaluate('window.goingUp.fastForward(3000)')
    wait_until(pg, '!!document.querySelector(".arcade-modal:not([hidden]) .arcade-sheet")')
    end = pg.evaluate('(() => { const b = window.goingUp.state.b; return { over: b.over, strikes: b.strikes, riders: b.you.delivered, title: document.querySelector(".arcade-sheet h2, .arcade-sheet .arcade-title").textContent }; })()')
    check(end['over'] and end['strikes'] == 3, f'going up: three people on the stairs end the shift ({end})')
    print('going up edith shift:', st, end)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)

    # ---- Cable Spaghetti ----
    pg.goto(BASE + 'cable-spaghetti'); pg.wait_for_timeout(400)
    close_help(pg)
    for lv in LEVELS:
        pg.click(f'.lvl[data-level="{lv}"]'); pg.wait_for_timeout(120)
    ROUTE = '''(() => {
        const d = window.cableSpaghetti.state.d, dev = d.unplugged()[d.unplugged().length - 1], path = d.route(dev);
        const svg = document.querySelector('#desk'), m = svg.getScreenCTM(), pt = svg.createSVGPoint();
        if (!path) return null;
        return path.map((i) => { pt.x = (i % 14) * 56 + 28; pt.y = Math.floor(i / 14) * 56 + 28; const q = pt.matrixTransform(m); return [q.x, q.y]; });
      })()'''
    for n in range(4):
        pts = pg.evaluate(ROUTE)
        if not pts:
            break
        pg.mouse.move(pts[0][0], pts[0][1]); pg.mouse.down()
        for x, y in pts[1:]:
            pg.mouse.move(x, y, steps=3)
        pg.mouse.up(); pg.wait_for_timeout(150)
    plugged = pg.evaluate('window.cableSpaghetti.state.d.plugged')
    check(plugged == 4, f'cable spaghetti: four cables dragged with the mouse ({plugged})')
    # one more with the arrow keys
    steps = pg.evaluate('''(() => { const d = window.cableSpaghetti.state.d, dev = d.unplugged()[d.unplugged().length - 1], p = d.route(dev);
        return p.slice(1).map((c, k) => { const a = p[k]; return c - a === 1 ? 'ArrowRight' : c - a === -1 ? 'ArrowLeft' : c > a ? 'ArrowDown' : 'ArrowUp'; }); })()''')
    for k in steps:
        pg.keyboard.press(k); pg.wait_for_timeout(40)
    check(pg.evaluate('window.cableSpaghetti.state.d.plugged') == 5, 'cable spaghetti: a cable laid with the arrow keys')
    # snip one cable, then route it again
    before = pg.evaluate('(() => { const d = window.cableSpaghetti.state.d; return { s: d.scissors, p: d.plugged }; })()')
    pg.keyboard.press('c'); pg.wait_for_timeout(100)
    cut = pg.evaluate('''(() => { const d = window.cableSpaghetti.state.d; const v = Object.values(d.devices).find((x) => x.plugged);
        const svg = document.querySelector('#desk'), m = svg.getScreenCTM(), pt = svg.createSVGPoint(); pt.x = (v.cell % 14) * 56 + 28; pt.y = Math.floor(v.cell / 14) * 56 + 28;
        const q = pt.matrixTransform(m); return [q.x, q.y, v.id]; })()''')
    pg.mouse.click(cut[0], cut[1]); pg.wait_for_timeout(150)
    mid = pg.evaluate('(() => { const d = window.cableSpaghetti.state.d; return { s: d.scissors, unplugged: d.unplugged().map((x) => x.id) }; })()')
    check(mid['s'] == before['s'] - 1 and cut[2] in mid['unplugged'], f'cable spaghetti: the scissors snip a cable ({before} -> {mid})')
    while pg.evaluate('window.cableSpaghetti.state.d.unplugged().length') > 0 and not pg.evaluate('window.cableSpaghetti.state.d.over'):
        pts = pg.evaluate(ROUTE)
        if not pts:
            break
        pg.mouse.move(pts[0][0], pts[0][1]); pg.mouse.down()
        for x, y in pts[1:]:
            pg.mouse.move(x, y, steps=3)
        pg.mouse.up(); pg.wait_for_timeout(150)
        if pg.evaluate('window.cableSpaghetti.state.d.plugged') >= 7:
            break
    after = pg.evaluate('window.cableSpaghetti.state.d.plugged')
    check(after >= before['p'], f'cable spaghetti: re-routing a snipped cable does not lose devices ({before} -> {after})')
    pg.screenshot(path=OUT + 'cable_spaghetti.png')
    # the desk may already have filled up on its own; otherwise call it a day
    if not pg.evaluate('window.cableSpaghetti.state.d.over'):
        pg.click('#btn-stop'); pg.wait_for_timeout(150)
        pg.click('.arcade-sheet .arcade-btn.main')
    wait_until(pg, 'window.cableSpaghetti.state.d.over && !!document.querySelector(".arcade-modal:not([hidden]) .arcade-sheet h2")')
    check(pg.evaluate('window.cableSpaghetti.state.d.over') and pg.evaluate('!!document.querySelector(".arcade-modal:not([hidden]) .arcade-sheet")'), 'cable spaghetti: calling it a day shows the end screen')
    print('cable spaghetti plugged:', after)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)

    # ---- Don't Click That ----
    pg.goto(BASE + 'dont-click-that'); pg.wait_for_timeout(400)
    close_help(pg)
    for lv in LEVELS:
        pg.click(f'.lvl[data-level="{lv}"]'); pg.wait_for_timeout(120)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    # drag a window with the mouse, like a player
    # the top window (last in the stack), so nothing else is lying on the spot we grab
    grab = pg.evaluate('''(() => { const d = window.dontClickThat.state.d, w = d.windows[d.windows.length - 1], c = document.querySelector('#desktop').getBoundingClientRect();
        const k = c.width / 960; return { id: w.id, x0: w.x, y0: w.y, sx: c.left + (w.x + 40) * k, sy: c.top + (w.y + 10) * k, k }; })()''')
    pg.mouse.move(grab['sx'], grab['sy']); pg.mouse.down()
    pg.mouse.move(grab['sx'] + 120 * grab['k'], grab['sy'] + 80 * grab['k'], steps=8); pg.mouse.up()
    moved = pg.evaluate(f'(() => {{ const w = window.dontClickThat.state.d.windows.find((v) => v.id === {grab["id"]}); return w ? [w.x, w.y] : null; }})()')
    check(moved is not None and (abs(moved[0] - grab['x0']) > 60 or abs(moved[1] - grab['y0']) > 40), f"don't click that: dragging a window moves it ({grab['x0']},{grab['y0']} -> {moved})")
    pg.wait_for_timeout(1500)
    t1 = pg.evaluate('window.dontClickThat.state.d.t')
    pg.keyboard.press('b'); pg.wait_for_timeout(100)
    t2 = pg.evaluate('window.dontClickThat.state.d.t'); pg.wait_for_timeout(600)
    check(t1 > 1 and pg.evaluate('window.dontClickThat.state.d.t') == t2, "don't click that runs, and pauses under the panic screen")
    pg.keyboard.press('b'); pg.wait_for_timeout(100)
    pg.screenshot(path=OUT + 'dont_click_that.png')
    pg.evaluate('window.dontClickThat.fastForward(1200)')
    wait_until(pg, '!!document.querySelector(".arcade-modal:not([hidden]) .arcade-sheet h2")')
    end = pg.evaluate('(() => { const d = window.dontClickThat.state.d; return { over: d.over, t: Math.round(d.t), title: document.querySelector(".arcade-sheet h2").textContent }; })()')
    check(end['over'], f"don't click that: the run ends when the pointer clicks ({end})")
    print("don't click that edith:", end)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)

    # ---- Badge Check ----
    pg.goto(BASE + 'badge-check'); pg.wait_for_timeout(400)
    close_help(pg)
    for lv in LEVELS:
        pg.click(f'.lvl[data-level="{lv}"]'); pg.wait_for_timeout(120)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(900)
    dates = pg.evaluate('''(() => { const n = new Date(), t = window.badgeCheck.state.sh.today;
        return { same: t.year === n.getFullYear() && t.month === n.getMonth() && t.day === n.getDate(),
                 badge: [...document.querySelectorAll('.badge .field-value')].pop().textContent }; })()''')
    year = dates['badge'].split()[-1]
    check(dates['same'] and year.isdigit() and len(year) == 4, f"badge check: today is the computer's date and badges show a year ({dates})")
    for n in range(5):
        fake = pg.evaluate('!!window.badgeCheck.state.sh.visitor.forged')
        pg.keyboard.press('ArrowLeft' if fake else 'ArrowRight'); pg.wait_for_timeout(1250)
    st = pg.evaluate('(() => { const sh = window.badgeCheck.state.sh; return { correct: sh.correct, served: sh.served, strikes: sh.strikes }; })()')
    check(st['correct'] == 5 and st['strikes'] == 0, f'badge check: five right calls with the arrow keys ({st})')
    pg.keyboard.press('p'); pg.wait_for_timeout(150)
    check(pg.evaluate('document.querySelector("#badge").style.visibility') == 'hidden', 'badge check: pausing hides the badge')
    pg.keyboard.press('p'); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT + 'badge_check.png')
    for n in range(3):
        fake = pg.evaluate('!!window.badgeCheck.state.sh.visitor.forged')
        pg.keyboard.press('ArrowRight' if fake else 'ArrowLeft'); pg.wait_for_timeout(1250)
    wait_until(pg, '!!document.querySelector(".arcade-modal:not([hidden]) .arcade-sheet h2")')
    end = pg.evaluate('(() => { const sh = window.badgeCheck.state.sh; return { over: sh.over, strikes: sh.strikes, correct: sh.correct }; })()')
    check(end['over'] and end['strikes'] == 3, f'badge check: three mistakes end the shift ({end})')
    print('badge check edith:', st, end)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)

    # ---- Volume: WNI's own music and sound levels, kept per device, sliders that leave the game alone ----
    pg.goto(BASE + 'copycat'); pg.wait_for_timeout(500)
    close_help(pg)
    pg.click('[data-tool="volume"]'); pg.wait_for_timeout(200)
    turn0 = pg.evaluate('window.copycat.state.game.turn')
    for _ in range(3):
        pg.keyboard.press('ArrowLeft')
    pg.wait_for_timeout(200)
    v = pg.evaluate('(() => ({ level: window.Arcade.volume("music"), gain: window.Arcade.audioBus("music").gain.value, turn: window.copycat.state.game.turn }))()')
    check(abs(v['level'] - 0.65) < 0.001 and abs(v['gain'] - 0.4225) < 0.02 and v['turn'] == turn0, f'volume: the music slider sets the level, the gain follows, the game stays put ({v})')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    check(not pg.evaluate('!!document.querySelector(".arcade-volume")'), 'volume: Escape closes the panel')
    pg.evaluate('window.Arcade.setVolume("music", 0.8)')

    # ---- every game has its own soundtrack, toggled from the top bar ----
    for g in GAMES:
        pg.goto(BASE + g); pg.wait_for_timeout(300)
        close_help(pg)
        pg.click('[data-tool="music"]'); pg.wait_for_timeout(700)
        on = pg.evaluate('window.Arcade.music.playing()')
        label = pg.evaluate('document.querySelector("[data-tool=music]").textContent')
        check(on and label == 'Music on', f'{g}: music plays from the in-game Music button')
        pg.click('[data-tool="music"]'); pg.wait_for_timeout(100)
        check(not pg.evaluate('window.Arcade.music.playing()'), f'{g}: the Music button turns it off again')
    print('soundtracks checked for', len(GAMES), 'games')

    # ---- in-app links: the same page stays alive, so the soundtrack carries on instead of starting over ----
    pg.goto(BASE); pg.wait_for_timeout(600)
    if not pg.evaluate('window.Arcade.music.on()'):
        pg.click('#btn-music')
    wait_until(pg, 'window.Arcade.music.playing() && window.Arcade.music.now().step >= 24')
    pg.evaluate('window.__sameDocument = true; window.__audio = window.Arcade.audio()')

    def alive():
        return pg.evaluate('window.__sameDocument === true && window.Arcade.audio() === window.__audio')

    before = pg.evaluate('window.Arcade.music.now()')
    pg.click('.tool-ranks')
    wait_until(pg, 'location.pathname === "/leaderboard" && !!document.querySelector(\'[data-page="leaderboard"] .site-bar\')')
    pg.wait_for_timeout(1000)   # a few beats, so a carried-on tune is clearly further along
    after = pg.evaluate('window.Arcade.music.now()')
    check(alive(), 'the leaderboard link should keep the same page (no reload)')
    check(bool(after) and after['tune'] == 'lobby' and after['step'] >= before['step'] + 3, f'the lobby tune should carry on into the leaderboard ({before} -> {after})')
    pg.click('.site-home')
    wait_until(pg, 'location.pathname === "/" && document.querySelectorAll(".gcard").length === 16')
    pg.wait_for_timeout(1000)
    back = pg.evaluate('window.Arcade.music.now()')
    check(alive() and bool(back) and back['tune'] == 'lobby' and back['step'] >= after['step'] + 3, f'the lobby tune should still be going back in the lobby ({after} -> {back})')
    pg.click('.gcard[href="/copycat"]')
    wait_until(pg, 'location.pathname === "/copycat" && !!window.copycat')
    close_help(pg)
    wait_until(pg, 'window.Arcade.music.now() && window.Arcade.music.now().tune === "copycat"')
    check(alive(), 'a game card should open the game in-app')
    left_bar = pg.evaluate('JSON.parse(sessionStorage.getItem("arcade-music-spot")).lobby')
    pg.wait_for_timeout(1500)
    pg.go_back()
    wait_until(pg, 'location.pathname === "/" && document.querySelectorAll(".gcard").length === 16')
    wait_until(pg, 'window.Arcade.music.now() && window.Arcade.music.now().tune === "lobby"')
    resumed = pg.evaluate('window.Arcade.music.now()')
    check(alive() and left_bar >= 2 and resumed['step'] >= left_bar * 8, f'the lobby tune should pick up at bar {left_bar}, not the start ({resumed})')
    print('music across links:', before, '->', after, '->', back, '| lobby left at bar', left_bar, 'and resumed at', resumed)

    # ---- styles: every page looks the same after in-app links as after a fresh load (no CSS leaks) ----
    SNAP = """(() => {
        const P = ['color', 'background-color', 'background-image', 'font-family', 'font-size', 'font-weight', 'font-style',
          'line-height', 'text-align', 'text-transform', 'letter-spacing', 'border-top-color', 'border-top-width',
          'border-top-left-radius', 'box-shadow', 'display', 'position', 'padding-top', 'padding-left', 'margin-top', 'gap', 'z-index'];
        const root = document.querySelector('.page-root');
        const els = [document.documentElement, document.body, ...root.querySelectorAll('[id], h1, h2, h3, header, main, button, a, .tool, .lvl')];
        const out = {}, seen = {};
        for (const el of els) {
          let key = el === document.documentElement ? 'html' : el === document.body ? 'body'
            : el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + [...el.classList].sort().join('.');
          seen[key] = (seen[key] || 0) + 1;
          key += ':' + seen[key];
          const cs = getComputedStyle(el);
          out[key] = Object.fromEntries(P.map((p) => [p, cs.getPropertyValue(p)]));
        }
        return out;
      })()"""
    # (an unknown address always gets a full page load, so the 404 page is not part of this lap)
    PAGES = [('', 'lobby'), ('leaderboard', 'leaderboard'), ('account', 'account'), ('credits', 'credits')] + [(g, g) for g in GAMES]
    lc = b.new_context(viewport={'width': 1366, 'height': 768})
    lp = lc.new_page()
    watch(lp, 'styles')
    fresh = {}
    for path, pid in PAGES:
        lp.goto(BASE + path); lp.wait_for_timeout(1000); close_help(lp); lp.wait_for_timeout(300)
        fresh[pid] = lp.evaluate(SNAP)

    def visit(path, pid):
        lp.evaluate(f'window.wniNavigate("/{path}")')
        wait_until(lp, f'location.pathname === "/{path}" && !!document.querySelector(\'.page-root[data-page="{pid}"]\')')
        lp.wait_for_timeout(1000); close_help(lp); lp.wait_for_timeout(300)

    lp.goto(BASE); lp.wait_for_timeout(600)
    lp.evaluate('window.__sameDocument = true')
    for path, pid in PAGES[1:] + PAGES[:1]:
        visit(path, pid)   # first lap: every page's stylesheet is now loaded in this one document
    compared = 0
    for path, pid in PAGES[1:] + PAGES[:1]:
        visit(path, pid)
        now = lp.evaluate(SNAP)
        common = [k for k in fresh[pid] if k in now]
        check(len(common) >= 0.8 * len(fresh[pid]), f'{pid}: only {len(common)} of {len(fresh[pid])} elements found after in-app links')
        for k in common:
            for prop, v in fresh[pid][k].items():
                if now[k][prop] != v:
                    errs.append(f'CHECK FAILED: {pid} {k} {prop} is "{now[k][prop]}" after in-app links but "{v}" on a fresh load')
            compared += 1
    check(lp.evaluate('window.__sameDocument === true'), 'the style lap should stay in one page')
    print('styles after in-app links match fresh loads:', compared, 'elements on', len(PAGES), 'pages')
    lc.close()

    # ---- phone width: nothing scrolls sideways ----
    phone = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    phone.on('dialog', lambda d: (errs.append('native dialog appeared: ' + d.message), d.dismiss()))
    pp = phone.new_page()
    watch(pp, 'phone')
    for page in ['', 'leaderboard', 'account', 'credits'] + GAMES:
        pp.goto(BASE + page); pp.wait_for_timeout(400)
        close_help(pp)
        sw = pp.evaluate('document.documentElement.scrollWidth')
        check(sw <= 390, f'{page} scrolls sideways at phone width ({sw}px)')
    pp.goto(BASE + 'sock-trap'); pp.wait_for_timeout(300); close_help(pp)
    pp.screenshot(path=OUT + 'phone_sock_trap.png', full_page=True)
    b.close()

print('\n'.join(errs) if errs else 'NO ERRORS')

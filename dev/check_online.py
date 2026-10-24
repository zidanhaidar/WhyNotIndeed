"""Online check: plays through accounts, scores and the leaderboard against a running WNI server.
It signs up a throwaway account named test_<random> (remove it afterwards if you like, see CLAUDE.md).

Usage: WNI_BASE=http://localhost:8080/ python dev/check_online.py
"""
import os
import random
import string
from playwright.sync_api import sync_playwright

BASE = os.environ.get('WNI_BASE', 'http://localhost:8080/')
errs = []
tag = ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(6))
USER, EMAIL, PW = 'test_' + tag, 'test_' + tag + '@example.com', 'correct horse ' + tag


def check(cond, msg):
    print(('ok    ' if cond else 'FAIL  ') + msg)
    if not cond:
        errs.append(msg)


def wait_until(pg, js, timeout=20000):
    waited = 0
    while not pg.evaluate(js):
        pg.wait_for_timeout(100)
        waited += 100
        if waited > timeout:
            raise TimeoutError('timed out waiting for ' + js)


def toasts(pg):
    return pg.evaluate('[...document.querySelectorAll(".arcade-toast-text")].map(t => t.textContent).join(" | ")')


def finish_sock_trap(pg):
    # a quick match on Pip: five offices, each played to its end at once; the score is handed in after the fifth
    for r in range(5):
        pg.evaluate('window.sockTrap.fastForward()')
        wait_until(pg, '!!document.querySelector(".arcade-modal:not([hidden]) .arcade-sheet h2")')
        if r < 4:
            pg.click('.arcade-sheet .arcade-btn.main'); pg.wait_for_timeout(200)
    pg.wait_for_timeout(1200)


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 860})
    ctx.on('dialog', lambda d: (errs.append('native dialog: ' + d.message), d.dismiss()))
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))

    # 1. guest run: the score is kept for after login
    pg.goto(BASE + 'sock-trap'); pg.wait_for_timeout(500)
    pg.keyboard.press('Escape')
    check(pg.evaluate('document.querySelector(".acct-chip").textContent') == 'Log in', 'guest sees a Log in chip')
    finish_sock_trap(pg)
    t = toasts(pg)
    check('Log in' in t and 'points' in t, 'guest run shows a WNI toast asking to log in: ' + t[:90])
    check(pg.evaluate('!!window.Arcade.store.get("arcade-pending-score", null)'), 'guest score is kept for after login')
    pg.keyboard.press('Escape')

    # 2. sign up through the chip; come back to the game
    pg.click('.acct-chip'); pg.wait_for_timeout(700)
    check('/account' in pg.url and 'next=' in pg.url, 'chip opens the account page with a way back')
    pg.click('.auth-tab[data-mode="signup"]')
    pg.fill('#f-username', 'x')
    pg.fill('#f-email', 'not-an-email')
    pg.fill('#f-password', 'short')
    pg.click('#auth-form [type="submit"]'); pg.wait_for_timeout(200)
    bad = pg.evaluate('[...document.querySelectorAll(".field.bad")].map(f => f.dataset.field).join(",")')
    check(bad == 'username,email,password', 'sign-up form flags bad fields inline: ' + bad)
    pg.fill('#f-username', USER)
    pg.fill('#f-email', EMAIL)
    pg.fill('#f-password', PW)
    pg.click('#auth-form [type="submit"]')
    wait_until(pg, 'location.pathname === "/sock-trap"', 8000)
    pg.wait_for_timeout(800)
    check(pg.evaluate('document.querySelector(".acct-chip .acct-name") && document.querySelector(".acct-chip .acct-name").textContent') == USER, 'back in the game, logged in as ' + USER)
    check(not pg.evaluate('!!window.Arcade.store.get("arcade-pending-score", null)'), 'the guest score was handed in after sign-up')

    # 3. a logged-in run saves straight away
    pg.keyboard.press('Escape')
    pg.evaluate('window.sockTrap.newGame()')
    finish_sock_trap(pg)
    t = toasts(pg)
    check('#' in t and 'Sock Trap board' in t, 'logged-in run is saved with a rank: ' + t[:100])

    # 4. leaderboard: filters, you are on it
    pg.goto(BASE + 'leaderboard?game=sock-trap'); pg.wait_for_timeout(900)
    names = pg.evaluate('[...document.querySelectorAll(".lb-table .nm")].map(n => n.textContent)')
    check(USER in names, 'you appear on the Sock Trap leaderboard')
    check(pg.evaluate('!!document.querySelector(".lb-table tr.you")'), 'your row is highlighted')
    pg.click('.lb-level[data-level="edith"]'); pg.wait_for_timeout(700)
    names_edith = pg.evaluate('[...document.querySelectorAll(".lb-table .nm")].map(n => n.textContent)')
    check(USER not in names_edith, 'the Edith filter hides your Pip runs')
    check('level=edith' in pg.url, 'filters are kept in the address')
    pg.click('.lb-game[data-game="all"]'); pg.wait_for_timeout(700)
    pg.click('.lb-level[data-level="all"]'); pg.wait_for_timeout(700)
    check(USER in pg.evaluate('[...document.querySelectorAll(".lb-table .nm")].map(n => n.textContent)'), 'you appear on the all-games board')
    pg.screenshot(path=os.path.join(os.path.dirname(__file__), 'out', 'online_leaderboard.png'), full_page=True)

    # 5. account page, log out, wrong password, log in with the email, then with the username
    pg.goto(BASE + 'account'); pg.wait_for_timeout(900)
    check(pg.evaluate('document.querySelector(".me-name").textContent') == USER, 'account page shows your profile')
    check('Rank #' in pg.evaluate('document.querySelector(".best:not(.empty)").textContent'), 'account page lists your best run with its rank')
    pg.screenshot(path=os.path.join(os.path.dirname(__file__), 'out', 'online_account.png'), full_page=True)
    pg.click('#btn-logout'); pg.wait_for_timeout(700)
    check(pg.evaluate('!!document.querySelector("#auth-form")'), 'logging out shows the log-in form')
    pg.fill('#f-login', EMAIL.upper())
    pg.fill('#f-password', 'wrong password')
    pg.click('#auth-form [type="submit"]'); pg.wait_for_timeout(900)
    msg = pg.evaluate('document.querySelector(".form-msg").textContent')
    check('do not match' in msg, 'wrong password is refused politely: ' + msg)
    pg.fill('#f-password', PW)
    pg.click('#auth-form [type="submit"]'); pg.wait_for_timeout(1200)
    check(pg.evaluate('!!document.querySelector(".me-name")'), 'log in with email and password works (email is not case sensitive)')
    pg.click('#btn-logout'); pg.wait_for_timeout(700)
    pg.fill('#f-login', 'not a name!')
    pg.fill('#f-password', PW)
    pg.click('#auth-form [type="submit"]'); pg.wait_for_timeout(300)
    check('letters, numbers or underscores' in pg.evaluate('document.querySelector("[data-field=login] .err").textContent'), 'a malformed username is flagged before sending')
    pg.fill('#f-login', USER.upper())
    pg.click('#auth-form [type="submit"]'); pg.wait_for_timeout(1200)
    check(pg.evaluate('document.querySelector(".me-name") && document.querySelector(".me-name").textContent') == USER, 'log in with the username works too (any capitals)')
    b.close()

print('test account:', USER)
print('\n'.join(errs) if errs else 'ALL GOOD')

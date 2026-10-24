# WNI: technical guide and deployment

> **Confidential.** This document describes the technical stack. The public site does not name it (the `/credits` page lists only fonts, data and services). Keep this repository private if the stack should stay private. Neither this file nor `README.md` is served by the website or copied into the Docker image.

For what WNI is and how the games are played, see [README.md](README.md).

---

## 1. Stack

| Part | Choice | Version |
|---|---|---|
| Web framework | Next.js, App Router, plain JavaScript (no TypeScript) | 16.4.2 |
| UI library | React and React DOM | 19.3.1 |
| Server runtime | Node.js (Docker image `node:22-alpine`) | 22 |
| Database | PostgreSQL (Docker image `postgres:16-alpine`) | 16 |
| Database driver | node-postgres (`pg`) | 8.23.1 |
| Containers | Docker with Docker Compose | Compose v2 or newer |
| Music and sound | Web Audio API in the browser, generated from code (no audio files) | |
| Fonts | 15 Google Fonts, self-hosted as `woff2` files (Latin subset) | |
| Outside service | Datamuse word API (Sneaky Hangman's word lists, cached weekly) | |

There are no other runtime dependencies: no CSS framework, no UI kit, no analytics, no external scripts.

## 2. How it fits together

```
 Browser ──HTTPS──> reverse proxy (Caddy, optional) ──> Next.js server (port 8080)
                                                          │  pages: /, /<game>, /leaderboard, /account, /credits
                                                          │  API:   /api/... (accounts, scores, leaderboard, words)
                                                          │  proxy.js: fresh CSP nonce on every page
                                                          ├──> PostgreSQL 16 (users, sessions, scores, word_lists)
                                                          └──> Datamuse API (at most once a week per word length)
```

- **Pages** are rendered by the server on every request (needed for the per-request CSP nonce). Each page renders its markup with React, then a small client component (`components/PageShell.jsx`) loads the shared WNI library and the page's own script, which runs the game. On unmount every listener, timer and animation frame is cleaned up.
- **Links between pages** are in-app navigations (`components/AppLinks.jsx`): the browser keeps one page alive, so the soundtrack carries on instead of restarting. Because every stylesheet stays loaded, each page's CSS is scoped to that page with `:where(html:has([data-page='<id>']))`.
- **Game logic** lives in `games/<id>/engine.js` (pure JavaScript, also used by the balance scripts in `dev/`); the UI is `games/<id>/game.js`.
- **The database schema** is created automatically when the server starts (`lib/server/schema.js`, everything `IF NOT EXISTS`). There are no manual migrations.

### Project layout

```
app/                Next.js routes: lobby, one folder per game, leaderboard, account, credits, api/
components/         PageShell (mounts page scripts), AppLinks (in-app links), LobbyMarkup
games/<id>/         engine.js, game.js, Markup.jsx, style.css (+ data.json, sprites.js where needed)
lib/client/         browser library: arcade.js (window.Arcade), music.js, account.js, site.js, page scripts
lib/server/         db.js, schema.js, auth.js, http.js, catalog.js, words.js, fallback-words.js
styles/             fonts.css, arcade.css, lobby.css, site.css
public/fonts/       self-hosted fonts and LICENSES.txt
public/legal/       notices.txt (open source notices for code sent to browsers; not linked from the site)
proxy.js            Content Security Policy with a per-request nonce
instrumentation.js  prepares the database tables at server start
next.config.mjs     standalone output, security headers, redirects from old .../index.html addresses
dev/                balance and browser test scripts (not part of the image)
Dockerfile, docker-compose.yml, .env.example
```

## 3. Configuration

All settings come from a `.env` file next to `docker-compose.yml` (copy `.env.example`).

| Variable | Default | Meaning |
|---|---|---|
| `POSTGRES_PASSWORD` | none (required) | Database password. Use a long random value. |
| `POSTGRES_DB` | `wni` | Database name. |
| `POSTGRES_USER` | `wni` | Database user. |
| `APP_PORT` | `8080` | Where the site listens on the host. Use `127.0.0.1:8080` behind a reverse proxy on the same machine. |
| `COOKIE_SECURE` | `false` | `true` when the site is served over HTTPS (login cookies are then HTTPS-only, and the CSP adds `upgrade-insecure-requests`). |
| `TRUST_PROXY` | `false` | `true` behind a reverse proxy, so the forwarded host is trusted for the origin check. |

Generate a password with `openssl rand -hex 24`.

## 4. Run it locally

```
cp .env.example .env            # then set POSTGRES_PASSWORD
docker compose up -d --build
open http://localhost:8080
```

Rebuild after changing code: `docker compose up -d --build`.

For faster front-end work you can run `npm install` and `npm run dev` (port 8080) against any PostgreSQL 16, with `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` and `PGDATABASE` set. The Compose database port is not published by default; add a `ports: ["127.0.0.1:55432:5432"]` override for the `db` service if you want to reach it from your machine.

## 5. Deploy to a server

A small virtual server is plenty: 1 vCPU, 1 GB RAM, about 2 GB of disk.

1. **Install Docker** with the Compose plugin on the server.
2. **Copy the project** (a private Git repository, or `rsync` without `node_modules`, `.next` and `dev/out`).
3. **Create `.env`** with a strong `POSTGRES_PASSWORD`, `APP_PORT=127.0.0.1:8080`, `COOKIE_SECURE=true`, `TRUST_PROXY=true`.
4. **Start it:** `docker compose up -d --build`, then check `curl http://127.0.0.1:8080/api/health` returns `{"ok":true}`.
5. **Put HTTPS in front.** With [Caddy](https://caddyserver.com) installed on the server, this `Caddyfile` gets a certificate automatically and forwards to WNI:

   ```
   wni.example.com {
       reverse_proxy 127.0.0.1:8080
   }
   ```

   Point the domain's DNS at the server, open ports 80 and 443, and reload Caddy.
6. **Optional: keep the whole site private.** To let only people with a password in, add basic authentication to the same block (create the hash with `caddy hash-password`):

   ```
   wni.example.com {
       basic_auth {
           friend <hash from caddy hash-password>
       }
       reverse_proxy 127.0.0.1:8080
   }
   ```

### Day-to-day

| Task | Command |
|---|---|
| Update to new code | `git pull` (or copy the files), then `docker compose up -d --build` |
| Logs | `docker compose logs -f app` |
| Back up scores and accounts | `docker compose exec -T db pg_dump -U wni wni > wni-backup.sql` |
| Restore a backup | `docker compose exec -T db psql -U wni -d wni < wni-backup.sql` |
| Stop | `docker compose down` (data stays in the `wni-db` volume) |
| Wipe everything | `docker compose down -v` (deletes all accounts and scores) |

## 6. Security

- **Passwords:** scrypt (N=32768, r=8, p=1, 64-byte key) with a fresh 16-byte random salt per user, stored as `scrypt$N$r$p$salt$hash`. Two users with the same password get different hashes. Unknown emails and usernames still spend a hash, so response times do not reveal which ones have accounts.
- **Sessions:** a random 32-byte token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` with `COOKIE_SECURE=true`), valid 30 days. The database only stores its SHA-256.
- **Logging in** works with the email address or the username (any capitals; usernames can never contain `@`, which tells the two apart).
- **Requests:** JSON-only bodies up to 16 KB, requests from a foreign `Origin` refused, rate limits on sign-up, login (per email or username typed, and per account, so switching between someone's email and username does not add guesses) and score saving.
- **Headers:** a strict Content Security Policy with a fresh nonce per page (`script-src 'self' 'nonce-...' 'strict-dynamic'`, no inline scripts, no eval in production, fonts and connections to this site only), plus `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` and a restrictive `Permissions-Policy`. The `X-Powered-By` header is off.
- **Scores** are reported by the browser and checked for plausibility (known game and level, whole number from 1 to 250,000) and rate-limited. A determined player could still submit a fake score; this is a fun leaderboard, not a competition with prizes.
- **Client IP** for rate limits comes from `X-Forwarded-For`. Without a reverse proxy that overwrites it, a client can fake it; the limits keyed on email, account and the whole site still apply.

## 7. Keeping the stack confidential

What is already in place:

- The `/credits` page lists fonts, data and the word service only, not the software.
- `X-Powered-By` is off, and errors never show stack traces to visitors.
- `README.md`, `DEPLOY.md` and `CLAUDE.md` are not served and not copied into the Docker image.
- The open source notices that the browser-side libraries' licenses require are kept in `public/legal/notices.txt`, which no page links to. Removing it would save a little secrecy at the cost of license compliance; it is recommended to keep it.

What cannot be hidden completely: a technical visitor can still recognise the framework from the page source (for example the `/_next/` paths of its script files). That is normal for any website built this way.

## 8. Outside services and credits

| Item | Used for | Author / owner | License or terms |
|---|---|---|---|
| Music and sound | All games | Original to WNI | |
| Art, characters, logo, games | Everything | Original to WNI | |
| Datamuse API | Sneaky Hangman's online word lists | Datamuse | Free up to 100,000 requests a day. Public apps are asked to acknowledge Datamuse in their documentation (done in `README.md` and on `/credits`). **An API key is required from 1 February 2027**: request one through the Datamuse feedback form with a short description of WNI, then add it in `lib/server/words.js`. Without a key the cached list, then the backup list, are used. Datamuse also asks customer-facing apps to describe themselves and their expected traffic; WNI makes at most 26 requests per word length per week. |
| Backup word list | Sneaky Hangman when the word service is down | Derived from wordfreq by Robyn Speer | CC BY-SA 4.0 (the list is shared under the same license) |
| Handwritten digits | Fool the Model (models and letters) | E. Alpaydin and C. Kaynak (1998), UCI Machine Learning Repository, doi:10.24432/C50P49 | CC BY 4.0 |
| Atkinson Hyperlegible | Body text | Braille Institute of America | SIL OFL 1.1 |
| Bowlby One | Lobby, site pages, Bury the Bot | Vernon Adams | SIL OFL 1.1 |
| Alfa Slab One | Fool the Model | JM Solé | SIL OFL 1.1 |
| Bungee | Excel Dungeon | David Jonathan Ross | SIL OFL 1.1 |
| Chewy | Sock Trap | Sideshow (Font Diner) | Apache 2.0 |
| Bangers | Spot Kick | Vernon Adams | SIL OFL 1.1 |
| Titan One | Sneaky Hangman | Rodrigo Fuenzalida | SIL OFL 1.1 |
| Luckiest Guy | Herd Instinct | Astigmatic | Apache 2.0 |
| Shrikhand | Coffee Spill | Jonny Pinhorn | SIL OFL 1.1 |
| Lilita One | Copycat | Juan Montoreano | SIL OFL 1.1 |
| Righteous | Echo | Astigmatic | SIL OFL 1.1 |
| Limelight | Going Up | Sorkin Type (Nicole Fally) | SIL OFL 1.1 |
| Rye | Cable Spaghetti | Sorkin Type (Nicole Fally) | SIL OFL 1.1 |
| VT323 | Don't Click That | Peter Hull | SIL OFL 1.1 |
| Special Elite | Badge Check | Astigmatic | Apache 2.0 |
| Next.js, React, React DOM, Scheduler, styled-jsx | Pages and UI (sent to browsers) | Vercel; Meta Platforms and contributors | MIT (notices in `public/legal/notices.txt`) |
| @swc/helpers | Compiled code helpers (sent to browsers) | SWC contributors | Apache 2.0 (in `public/legal/notices.txt`) |
| node-postgres (`pg`) | Database driver (server only) | Brian Carlson and contributors | MIT |
| PostgreSQL | Database (server only) | The PostgreSQL Global Development Group | PostgreSQL License |
| Node.js | Server runtime | OpenJS Foundation and contributors | MIT-style Node.js license |

Full font license texts are in `public/fonts/LICENSES.txt`.

## 9. Tests and balance checks

Run from the project folder. The Python checks need `pip install playwright` and `playwright install chromium`, and a running WNI (default `http://localhost:8080/`, or set `WNI_BASE`).

| Command | What it checks |
|---|---|
| `python dev/check_all_games.py` | Lobby, site pages (the Credits page must name no software and leave no gaps between cards) and all 14 games in a headless browser: plays a little, WNI dialogs instead of native ones, panic button pauses games and silences music, every soundtrack toggles, links keep the music going, styles never leak between pages, no sideways scrolling at phone width. |
| `python dev/check_online.py` | Accounts and leaderboard end to end. Creates a throwaway `test_...` account (delete with `docker compose exec db psql -U wni -d wni -c "DELETE FROM users WHERE username LIKE 'test\_%'"`). |
| `node dev/balance_<game>.js` | Plays a game thousands of times with scripted players to prove every level, Edith included, is winnable and that levels get harder in order. For the four endless games (`balance_going_up.js`, `balance_cable_spaghetti.js`, `balance_dont_click_that.js`, `balance_badge_check.js`) it proves a good player usually earns the first star on every level, a careless one does clearly worse, and every run ends. |

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| Changed `POSTGRES_PASSWORD` and the app cannot connect | PostgreSQL only sets the password when the volume is first created. Change it inside the database (`ALTER USER wni PASSWORD '...'`) or start fresh with `docker compose down -v`. |
| Port 8080 is taken | Set `APP_PORT` to another port in `.env`. |
| Logging in does nothing over plain `http://` | `COOKIE_SECURE=true` only works over HTTPS. Use `false` for local testing. |
| Sneaky Hangman says it is using the backup word list | The server could not reach the Datamuse API (no internet, or no API key after 1 February 2027). The game keeps working with the cached or backup list. |
| A page looks unstyled after an update | Rebuild with `docker compose up -d --build` and reload the page. |

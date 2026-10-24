/*
 * WNI accounts and leaderboard client: window.Arcade.account.
 * Talks to the WNI API routes (app/api) on the same site.
 */
(function (global) {
  'use strict';
  var A = global.Arcade;
  var PENDING_KEY = 'arcade-pending-score';
  var PENDING_MAX_AGE = 30 * 60 * 1000;

  var ROOT = '/';

  var user = A.store.get('arcade-user', null);
  var status = 'unknown';
  var listeners = [];

  function emit() { listeners.slice().forEach(function (f) { f(user, status); }); }
  function setUser(u) {
    user = u ? { id: u.id, username: u.username, email: u.email } : null;
    A.store.set('arcade-user', user);
    emit();
  }

  function request(method, path, body) {
    return fetch(ROOT + 'api/' + path, {
      method: method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.status === 401 && user && path !== 'auth/login') setUser(null);
        return { ok: r.ok, status: r.status, data: data };
      });
    }, function () {
      return { ok: false, status: 0, data: { error: 'Cannot reach the WNI server right now.' } };
    });
  }

  function refresh() {
    return request('GET', 'me').then(function (r) {
      if (r.ok) { status = 'ready'; setUser(r.data.user); }
      else { status = r.status === 0 ? 'unreachable' : 'ready'; emit(); }
      return user;
    });
  }

  function loginUrl(mode) {
    var next = global.location.pathname + global.location.search;
    return '/account?' + (mode ? 'mode=' + mode + '&' : '') + 'next=' + encodeURIComponent(next);
  }

  var AVA = ['#FF6B57', '#3D86F0', '#2FBF71', '#FFC93C', '#B07CC6', '#F09A4A'];
  function avatarColor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return AVA[h % AVA.length];
  }

  // Renders the account chip in a game's top bar (or anywhere) and keeps it current. Returns a function that stops it.
  function chip(el) {
    if (!el) return function () {};
    function render() {
      if (user) {
        el.innerHTML = '<a class="acct-chip" href="/account" title="Your WNI account" style="--ava:' + avatarColor(user.username) + '">' +
          '<span class="acct-ava" aria-hidden="true">' + A.esc(user.username.charAt(0).toUpperCase()) + '</span><span class="acct-name">' + A.esc(user.username) + '</span></a>';
      } else {
        el.innerHTML = '<a class="acct-chip guest" href="' + loginUrl() + '">Log in</a>';
      }
    }
    var off = onChange(render);
    render();
    return off;
  }
  function onChange(f) {
    listeners.push(f);
    return function () { var i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); };
  }

  function fmt(n) { return Number(n).toLocaleString('en-US'); }

  /*
   * Called by every game when a run ends. points is already multiplied for the opponent level.
   * Logged in: saved to the leaderboard. Guest: kept for 30 minutes so it is saved right after logging in.
   */
  function submit(game, level, points, detail) {
    points = Math.max(0, Math.round(points || 0));
    if (!points) return Promise.resolve(null);
    var g = A.GAME_MAP[game], name = g ? g.name : 'this game';
    var board = '/leaderboard?game=' + encodeURIComponent(game);
    var entry = { game: game, level: level, score: points, detail: String(detail || '').slice(0, 80) };
    if (!user) {
      A.store.set(PENDING_KEY, Object.assign({ at: Date.now() }, entry));
      A.toast(fmt(points) + ' points! Log in and they go straight onto the ' + name + ' leaderboard.', { kind: 'info', action: { label: 'Log in', href: loginUrl() } });
      return Promise.resolve(null);
    }
    return request('POST', 'scores', entry).then(function (r) {
      if (r.ok) {
        var d = r.data;
        A.toast((d.personalBest ? 'New personal best! ' : 'Saved. ') + fmt(points) + ' points puts you at #' + d.rank + ' on the ' + name + ' board.',
          { kind: 'good', action: { label: 'Ranks', href: board } });
      } else if (r.status === 401) {
        A.store.set(PENDING_KEY, Object.assign({ at: Date.now() }, entry));
        A.toast('You were logged out. Log in again to save these ' + fmt(points) + ' points.', { kind: 'bad', action: { label: 'Log in', href: loginUrl() } });
      } else {
        A.toast((r.data && r.data.error) || 'Could not save your score. Check your connection and try again.', { kind: 'bad' });
      }
      return r.ok ? r.data : null;
    });
  }

  // Saves a guest's last score after they log in or sign up. Resolves to the saved entry, or null.
  function flushPending() {
    var p = A.store.get(PENDING_KEY, null);
    if (!p || !user) return Promise.resolve(null);
    A.store.set(PENDING_KEY, null);
    if (Date.now() - p.at > PENDING_MAX_AGE) return Promise.resolve(null);
    return request('POST', 'scores', { game: p.game, level: p.level, score: p.score, detail: p.detail }).then(function (r) {
      return r.ok ? Object.assign({}, p, r.data) : null;
    });
  }

  function auth(path, body) {
    return request('POST', path, body).then(function (r) {
      if (r.ok) { status = 'ready'; setUser(r.data.user); }
      return r;
    });
  }

  A.account = {
    online: true,
    root: ROOT,
    user: function () { return user; },
    status: function () { return status; },
    onChange: onChange,
    words: function (len) { return request('GET', 'words?len=' + encodeURIComponent(len)); },
    refresh: refresh,
    request: request,
    chip: chip,
    loginUrl: loginUrl,
    avatarColor: avatarColor,
    submit: submit,
    flushPending: flushPending,
    // `login` is an email address or a username
    login: function (login, password) { return auth('auth/login', { login: login, password: password }); },
    signup: function (username, email, password) { return auth('auth/signup', { username: username, email: email, password: password }); },
    logout: function () { return request('POST', 'auth/logout', {}).then(function (r) { setUser(null); return r; }); },
    leaderboard: function (game, level) {
      return request('GET', 'leaderboard?game=' + encodeURIComponent(game) + (level && level !== 'all' ? '&level=' + encodeURIComponent(level) : ''));
    },
    myScores: function () { return request('GET', 'me/scores'); }
  };

  // Leaderboard points: a game's base score times the opponent's multiplier (Pip 1, Ted 2, Excel 3, Edith 5).
  A.points = function (levelId, base) {
    var L = A.LEVEL_MAP[levelId] || A.LEVELS[0];
    return Math.max(0, Math.round(base * L.mult));
  };

  refresh();
})(window);

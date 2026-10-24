/* WNI leaderboard: best run per player, filtered by game and by opponent. */
export function mount() {
  var A = window.Arcade, AC = A.account;
  var sc = A.scope();
  var main = document.getElementById('main');
  var params = new URLSearchParams(window.location.search);
  var state = {
    game: A.GAME_MAP[params.get('game')] ? params.get('game') : 'all',
    level: A.LEVEL_MAP[params.get('level')] ? params.get('level') : 'all',
    req: 0
  };

  sc.add(A.siteBar(document.getElementById('bar'), {
    title: 'Leaderboard',
    links: [{ href: '/account', icon: 'ranks', label: 'My runs' }]
  }));

  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' d ago';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function gameName() { return state.game === 'all' ? 'All games' : A.GAME_MAP[state.game].name; }
  function gameColor() { return state.game === 'all' ? '#1D1A33' : A.GAME_MAP[state.game].color; }

  main.innerHTML =
    '<div class="lb-filters">' +
    '<div class="lb-games" role="group" aria-label="Game"></div>' +
    '<div class="lb-levels" role="group" aria-label="Opponent"></div></div>' +
    '<div class="lb-main"><section class="lb-board sticker" aria-live="polite"></section><aside class="lb-side"></aside></div>';

  function renderFilters() {
    var games = [{ id: 'all', name: 'All games', color: '#1D1A33' }].concat(A.GAMES);
    main.querySelector('.lb-games').innerHTML = games.map(function (g) {
      return '<button type="button" class="lb-game" data-game="' + g.id + '" style="--g:' + g.color + '" aria-pressed="' + (g.id === state.game) + '"><i></i>' + A.esc(g.name) + '</button>';
    }).join('');
    main.querySelector('.lb-levels').innerHTML = '<button type="button" class="lb-level" data-level="all" aria-pressed="' + (state.level === 'all') + '">Every opponent</button>' +
      A.LEVELS.map(function (L) {
        return '<button type="button" class="lb-level" data-level="' + L.id + '" style="--c:' + L.color + '" aria-pressed="' + (L.id === state.level) + '"><i></i>' + L.name + '</button>';
      }).join('');
  }
  main.querySelector('.lb-filters').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.game) state.game = b.dataset.game;
    if (b.dataset.level) state.level = b.dataset.level;
    A.jingle('tick');
    var q = (state.game !== 'all' ? 'game=' + state.game : '') + (state.level !== 'all' ? (state.game !== 'all' ? '&' : '') + 'level=' + state.level : '');
    history.replaceState(null, '', q ? '?' + q : window.location.pathname);
    renderFilters();
    load();
  });

  function renderSide(data) {
    var side = main.querySelector('.lb-side');
    var u = AC.user();
    var you;
    if (!u) you = '<h3>Where do you rank?</h3><p>Log in and every run you finish lands on this board.</p><a class="btn-ink" href="' + AC.loginUrl() + '">Log in</a>' +
      '<p style="margin:10px 0 0"><a href="/account?mode=signup">or make an account</a></p>';
    else if (data && data.me) you = '<h3>You, ' + A.esc(u.username) + '</h3><div class="big">#' + data.me.rank + '</div><p>' + fmt(data.me.score) + ' points' + (data.me.detail ? ', ' + A.esc(data.me.detail) : '') + '</p>' +
      (state.game !== 'all' ? '<a class="btn-plain" href="../' + A.GAME_MAP[state.game].path + '">Beat it</a>' : '');
    else you = '<h3>You, ' + A.esc(u.username) + '</h3><p>No runs on this board yet.</p>' + (state.game !== 'all' ? '<a class="btn-ink" href="../' + A.GAME_MAP[state.game].path + '">Play ' + A.esc(gameName()) + '</a>' : '');

    var how = state.game === 'all'
      ? '<p>Your best run in each game, added together. Play all fourteen to climb.</p>'
      : '<p>' + A.esc(A.GAME_MAP[state.game].scoring) + '</p>';
    side.innerHTML = '<div class="lb-you sticker">' + you + '</div>' +
      '<div class="lb-how sticker"><h3>How points work</h3>' + how +
      '<p>Then it is multiplied by your opponent:</p><ul>' + A.LEVELS.map(function (L) {
        return '<li style="--c:' + L.color + '"><i></i>' + L.name + '<b>x' + L.mult + '</b></li>';
      }).join('') + '</ul></div>';
  }

  function oppCell(level) {
    var L = A.LEVEL_MAP[level];
    return L ? '<span class="opp">' + A.face(L.id, 'calm') + '<span>' + L.name + '</span></span>' : '';
  }

  function renderBoard(data) {
    var board = main.querySelector('.lb-board');
    var rows = data.rows;
    var head = '<div class="lb-head"><h2 style="color:' + gameColor() + '">' + A.esc(gameName()) + '</h2><span class="lb-count">' +
      data.players + ' player' + (data.players === 1 ? '' : 's') + (state.level !== 'all' ? ' vs ' + A.LEVEL_MAP[state.level].name : '') + '</span></div>';
    if (!rows.length) {
      board.innerHTML = head + '<div class="lb-empty">' + A.face(state.level !== 'all' ? state.level : 'pip', 'surprised', 'cface') +
        '<p>Nobody is on this board yet. The top spot is wide open.</p>' +
        (state.game !== 'all' ? '<a class="btn-ink" href="../' + A.GAME_MAP[state.game].path + '">Play ' + A.esc(gameName()) + '</a>' : '<a class="btn-ink" href="/">Pick a game</a>') + '</div>';
      return;
    }
    var medals = ['1', '2', '3'];
    var pod = [1, 0, 2].map(function (i) {
      var r = rows[i];
      if (!r) return '<div class="pod p' + (i + 1) + ' empty"><span class="medal">' + medals[i] + '</span><span class="who">Free spot</span></div>';
      var L = A.LEVEL_MAP[r.level];
      return '<div class="pod p' + (i + 1) + '"><span class="medal">' + r.rank + '</span><span class="who">' + A.esc(r.username) + '</span>' +
        '<span class="pts">' + fmt(r.score) + '</span><span class="lvl-tag">' + (L ? 'vs ' + L.name : A.esc(r.detail || '')) + '</span></div>';
    }).join('');
    var table = '<table class="lb-table"><thead><tr><th>#</th><th>Player</th><th class="num">Points</th><th>' + (state.game === 'all' ? '' : 'Opponent') + '</th><th class="det">Run</th><th class="when">When</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr' + (r.you ? ' class="you"' : '') + '><td>' + r.rank + '</td>' +
          '<td><span class="pl"><span class="ava" style="--ava:' + AC.avatarColor(r.username) + '">' + A.esc(r.username.charAt(0).toUpperCase()) + '</span><span class="nm">' + A.esc(r.username) + '</span>' +
          (r.you ? '<span class="you-tag">you</span>' : '') + '</span></td>' +
          '<td class="num">' + fmt(r.score) + '</td><td>' + oppCell(r.level) + '</td><td class="det">' + A.esc(r.detail || '') + '</td><td class="when">' + ago(r.at) + '</td></tr>';
      }).join('') + '</tbody></table>';
    board.innerHTML = head + '<div class="podium">' + pod + '</div>' + table;
  }

  function load() {
    var board = main.querySelector('.lb-board');
    board.innerHTML = '<p class="loading">Counting the points...</p>';
    var id = ++state.req;
    AC.leaderboard(state.game, state.level).then(function (r) {
      if (id !== state.req || !sc.alive()) return;
      if (!r.ok) {
        board.innerHTML = '<div class="note">' + A.esc((r.data && r.data.error) || 'The leaderboard is not answering right now.') + '</div>';
        A.toast('Could not load the leaderboard. Try again in a moment.', { kind: 'bad' });
        renderSide(null);
        return;
      }
      renderBoard(r.data);
      renderSide(r.data);
    });
  }

  sc.add(AC.onChange(function () { load(); }));
  renderFilters();
  load();
  return sc.dispose;
}

/* Header for the WNI site pages (account, leaderboard): lobby link, page title, audio, panic button, account chip.
 * Returns a function that removes its listeners. */
(function () {
  'use strict';
  var A = window.Arcade;

  A.siteBar = function (el, o) {
    el.className = 'site-bar';
    el.innerHTML =
      '<a class="site-home" href="/" title="Back to the WNI lobby">' + A.logo({ compact: true, label: false }) + '<span>Lobby</span></a>' +
      '<h1 class="site-title">' + A.esc(o.title) + '</h1>' +
      '<div class="tools">' +
      '<button type="button" class="tool" data-tool="music"></button>' +
      '<button type="button" class="tool" data-tool="sound"></button>' +
      (o.links || []).map(function (l) { return '<a class="tool" href="' + l.href + '">' + A.icon(l.icon) + '<span>' + A.esc(l.label) + '</span></a>'; }).join('') +
      '<button type="button" class="tool" data-tool="hide" title="Turn the screen into a boring spreadsheet">' + A.icon('hide') + '<span>Panic (B)</span></button>' +
      '<span class="arcade-account"></span>' +
      '</div>';
    var music = el.querySelector('[data-tool="music"]'), sound = el.querySelector('[data-tool="sound"]');
    function render() {
      var m = A.music.on(), s = A.soundOn();
      music.innerHTML = A.icon('music', !m) + '<span>Music ' + (m ? 'on' : 'off') + '</span>';
      music.setAttribute('aria-pressed', String(m));
      sound.innerHTML = A.icon('sound', !s) + '<span>Sound ' + (s ? 'on' : 'off') + '</span>';
      sound.setAttribute('aria-pressed', String(s));
    }
    var offAudio = A.onAudioChange(render);
    render();
    music.addEventListener('click', function () { A.music.toggle(); });
    sound.addEventListener('click', function () { A.setSound(!A.soundOn()); A.jingle('tick'); });
    el.querySelector('[data-tool="hide"]').addEventListener('click', A.toggleBoss);
    var offChip = A.account.chip(el.querySelector('.arcade-account'));
    A.music.play(o.music || 'lobby');
    return function () { offAudio(); offChip(); };
  };
})();

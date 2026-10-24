// Credits and the 404 page have no script of their own; they keep the lobby tune going.
// On Credits, the LICENSES link opens the font licenses in a WNI dialog instead of a bare text file.
export function mount() {
  var A = window.Arcade, sc = A.scope(), text = null;
  A.music.play('lobby');

  function show() {
    A.modal({
      title: 'Font licenses',
      wide: true,
      html: '<pre class="license-text" tabindex="0">' + A.esc(text) + '</pre>',
      buttons: [{ label: 'Close', kind: 'main' }]
    });
  }

  document.querySelectorAll('[data-licenses]').forEach(function (link) {
    sc.on(link, 'click', function (e) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      if (text != null) return show();
      fetch(link.getAttribute('href')).then(function (r) {
        if (!r.ok) throw new Error('status ' + r.status);
        return r.text();
      }).then(function (t) {
        if (!sc.alive()) return;
        text = t;
        show();
      }, function () {
        if (sc.alive()) A.toast('The license file did not load. Try again in a moment.', { kind: 'bad' });
      });
    });
  });
  return sc.dispose;
}

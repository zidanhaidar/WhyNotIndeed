/* Loads the shared WNI library once per page, in order, and resolves to window.Arcade. Browser only. */
let booted = null;

export function boot() {
  if (!booted) {
    booted = (async () => {
      await import('./arcade.js');
      await import('./music.js');
      await import('./account.js');
      await import('./site.js');
      return window.Arcade;
    })();
  }
  return booted;
}

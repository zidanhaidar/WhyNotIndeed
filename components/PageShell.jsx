'use client';

/*
 * Hosts one WNI page. The page structure is rendered by React (children); the game or page script then
 * takes over that markup in the browser. On unmount the script cleans up its listeners and timers,
 * and the markup goes back to exactly what the server sent.
 * data-page tells the stylesheets which page is showing: each page's CSS is scoped to it, because in-app
 * links keep every stylesheet loaded.
 */
import { memo, useLayoutEffect, useRef } from 'react';
import { boot } from '@/lib/client/boot.js';

const PAGES = {
  lobby: () => import('@/lib/client/lobby.js'),
  leaderboard: () => import('@/lib/client/leaderboard-page.js'),
  account: () => import('@/lib/client/account-page.js'),
  credits: () => import('@/lib/client/site-page.js'),
  'not-found': () => import('@/lib/client/site-page.js'),
  'bury-the-bot': () => import('@/games/bury-the-bot/game.js'),
  'fool-the-model': () => import('@/games/fool-the-model/game.js'),
  'excel-dungeon': () => import('@/games/excel-dungeon/game.js'),
  'sock-trap': () => import('@/games/sock-trap/game.js'),
  'spot-kick': () => import('@/games/spot-kick/game.js'),
  'sneaky-hangman': () => import('@/games/sneaky-hangman/game.js'),
  'herd-instinct': () => import('@/games/herd-instinct/game.js'),
  'coffee-spill': () => import('@/games/coffee-spill/game.js'),
  copycat: () => import('@/games/copycat/game.js'),
  echo: () => import('@/games/echo/game.js'),
  'going-up': () => import('@/games/going-up/game.js'),
  'cable-spaghetti': () => import('@/games/cable-spaghetti/game.js'),
  'dont-click-that': () => import('@/games/dont-click-that/game.js'),
  'badge-check': () => import('@/games/badge-check/game.js'),
  sudoku: () => import('@/games/sudoku/game.js'),
  minesweeper: () => import('@/games/minesweeper/game.js')
};

function PageShell({ page, children }) {
  const ref = useRef(null);

  // A layout effect, so on an in-app link the script stops in the same commit that removes its markup:
  // a plain effect runs a frame later, when the game's own loop could still fire on missing elements.
  useLayoutEffect(() => {
    const root = ref.current;
    const markup = root.innerHTML;
    let dispose = null;
    let cancelled = false;
    boot()
      .then(() => PAGES[page]())
      .then((mod) => { if (!cancelled) dispose = mod.mount(); })
      .catch((err) => {
        if (cancelled) return;
        if (window.Arcade) window.Arcade.toast('This page did not load properly. Try reloading it.', { kind: 'bad', ms: 9000 });
        throw err;
      });
    return () => {
      cancelled = true;
      if (dispose) dispose();
      root.innerHTML = markup;
    };
  }, [page]);

  return <div ref={ref} className="page-root" data-page={page}>{children}</div>;
}

export default memo(PageShell);

'use client';

/*
 * Makes every plain link between WNI pages an in-app navigation, so the browser keeps the same page alive
 * and the soundtrack carries on instead of starting over. Links elsewhere (other sites, files, new tabs,
 * modified clicks) behave as usual. Scripts navigate with window.wniNavigate(url) (see Arcade.go).
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The in-app address for a link or URL, or null when the browser should handle it.
function appUrl(href, anchor) {
  if (!href) return null;
  if (anchor && ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download'))) return null;
  let url;
  try { url = new URL(href, window.location.href); } catch { return null; }
  if (url.origin !== window.location.origin) return null;
  if (/^\/(api|_next|fonts|legal)\//.test(url.pathname) || /\.[a-z0-9]+$/i.test(url.pathname)) return null;
  const here = window.location;
  if (url.hash && url.pathname === here.pathname && url.search === here.search) return null;
  return url.pathname + url.search + url.hash;
}

function linkOf(event) {
  const el = event.target;
  return el && el.closest ? el.closest('a[href]') : null;
}

export default function AppLinks() {
  const router = useRouter();

  useEffect(() => {
    const prefetched = new Set();
    function onClick(e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = linkOf(e);
      const url = a && appUrl(a.getAttribute('href'), a);
      if (!url) return;
      e.preventDefault();
      router.push(url);
    }
    function onHover(e) {
      const a = linkOf(e);
      const url = a && appUrl(a.getAttribute('href'), a);
      if (!url || prefetched.has(url)) return;
      prefetched.add(url);
      router.prefetch(url);
    }
    window.wniNavigate = (href) => {
      const url = appUrl(href, null);
      if (url) router.push(url);
      else window.location.assign(href);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('pointerover', onHover, { passive: true });
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('pointerover', onHover);
      delete window.wniNavigate;
    };
  }, [router]);

  return null;
}

'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const PUBLIC_PREFIXES = ['/', '/offres', '/souscription', '/tarifs', '/contact', '/conditions', '/connexion'];

function isPublicPath(path: string) {
  if (path === '/') return true;
  return PUBLIC_PREFIXES.slice(1).some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function id(storage: Storage, key: string) {
  let value = storage.getItem(key);
  if (!value) {
    value = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    storage.setItem(key, value);
  }
  return value;
}

function track(payload: Record<string, any>) {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return;
  fetch(`${base}/analytics/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const lastPath = useRef('');

  useEffect(() => {
    if (!isPublicPath(pathname) || lastPath.current === pathname) return;
    lastPath.current = pathname;
    const visitorId = id(localStorage, 'coffria_visitor_id');
    const sessionId = id(sessionStorage, 'coffria_session_id');
    track({ eventType: 'PAGE_VIEW', visitorId, sessionId, path: pathname, referrer: document.referrer || null });
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!isPublicPath(window.location.pathname)) return;
      const target = event.target as HTMLElement | null;
      const actionable = target?.closest('a,button') as HTMLElement | null;
      if (!actionable) return;
      const visitorId = id(localStorage, 'coffria_visitor_id');
      const sessionId = id(sessionStorage, 'coffria_session_id');
      const href = actionable instanceof HTMLAnchorElement ? actionable.getAttribute('href') : null;
      track({
        eventType: 'CLICK',
        visitorId,
        sessionId,
        path: window.location.pathname,
        target: href || actionable.getAttribute('aria-label') || null,
        label: (actionable.textContent || actionable.getAttribute('aria-label') || '').trim().slice(0, 300),
        referrer: document.referrer || null,
      });
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true } as any);
  }, []);

  return null;
}

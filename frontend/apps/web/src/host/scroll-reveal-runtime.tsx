'use client';

import { ViewportRevealProvider } from '@clouddrive/surface-foundation/viewport-reveal';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';

/** Document is the content scroll owner; sidebar/settings navigation scroll separately. */
export function ScrollRevealRuntime({ children }: Readonly<{ children: ReactNode }>) {
  const fastUntil = useRef(0);
  useEffect(() => {
    let previousScroll = window.scrollY;
    let previousTime = performance.now();
    const onScroll = () => {
      const now = performance.now();
      // Scalar samples only. No DOM layout reads, state updates or per-item scroll handlers.
      if (Math.abs(window.scrollY - previousScroll) / Math.max(1, now - previousTime) > 2) {
        fastUntil.current = now + 160;
      }
      previousScroll = window.scrollY;
      previousTime = now;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const readViewport = useCallback(
    () => ({
      fast: performance.now() < fastUntil.current,
      restored: window.scrollY > 0 || Boolean(location.hash),
    }),
    [],
  );
  return <ViewportRevealProvider readViewport={readViewport}>{children}</ViewportRevealProvider>;
}

/** Browser lifecycle adapter for the local workbench. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
const subscribe = (notify: () => void) => {
  globalThis.addEventListener('resize', notify);
  return () => globalThis.removeEventListener('resize', notify);
};
export function useNarrowWorkbench() {
  return useSyncExternalStore(
    subscribe,
    () => globalThis.innerWidth < 1280,
    () => false,
  );
}
export function isReferenceRefreshPaused() {
  return document.visibilityState === 'hidden' || !navigator.onLine;
}

/** Let the collection commit its selection focus before HeroUI captures the return target. */
export function useWorkbenchDetailDrawer() {
  const [isOpen, setOpen] = useState(false);
  const frame = useRef<number | null>(null);
  const cancelFrame = () => {
    if (frame.current !== null) globalThis.cancelAnimationFrame(frame.current);
    frame.current = null;
  };
  const onOpenChange = (next: boolean) => {
    cancelFrame();
    setOpen(next);
  };
  useEffect(() => {
    const closeOnDesktop = () => {
      if (globalThis.innerWidth >= 1280) {
        if (frame.current !== null) globalThis.cancelAnimationFrame(frame.current);
        frame.current = null;
        setOpen(false);
      }
    };
    globalThis.addEventListener('resize', closeOnDesktop);
    return () => {
      globalThis.removeEventListener('resize', closeOnDesktop);
      if (frame.current !== null) globalThis.cancelAnimationFrame(frame.current);
    };
  }, []);
  return {
    isOpen,
    onOpenChange,
    open: () => {
      cancelFrame();
      frame.current = globalThis.requestAnimationFrame(() => {
        frame.current = null;
        if (globalThis.innerWidth < 1280) setOpen(true);
      });
    },
  };
}

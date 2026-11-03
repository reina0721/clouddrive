'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { generatedSurfaceRegistry } from '@clouddrive/surface/generated/composition';
import { useWorkbenchStore } from '../state/use-workbench-store';

/** Record committed catalog pages. Only entity identity is retained from search parameters. */
export function useRecentVisitRecorder(
  entries: ReadonlyArray<{ href: string; label: string }>,
): void {
  const pathname = usePathname();
  useEffect(() => {
    if (
      pathname !== '/' &&
      !Object.values(generatedSurfaceRegistry.routes).some((route) => route.pattern === pathname)
    )
      return;
    let frame = 0;
    let previous = '';
    const record = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const content = document.querySelector('.surface-route-content');
        const title =
          content?.querySelector('h1')?.textContent?.trim() ||
          entries.find((entry) => entry.href === pathname)?.label;
        if (!title || location.pathname !== pathname) return;
        const id = new URLSearchParams(location.search).get('id');
        if (/\/(detail|edit)$/.test(pathname) && !id) return;
        const href =
          pathname +
          (id &&
          [
            '/reference-resources/detail',
            '/reference-resources/edit',
            '/users/detail',
            '/users/edit',
            '/roles/detail',
            '/roles/edit',
            '/notifications/detail',
            '/audit-logs/detail',
          ].includes(pathname)
            ? '?id=' + encodeURIComponent(id)
            : '');
        const signature = href + ':' + title;
        if (signature === previous) return;
        previous = signature;
        useWorkbenchStore.getState().recordVisit({ pathname: href, title });
      });
    };
    const observer = new MutationObserver(record);
    const content = document.querySelector('.surface-route-content');
    if (content) observer.observe(content, { childList: true, subtree: true, characterData: true });
    record();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [pathname, entries]);
}

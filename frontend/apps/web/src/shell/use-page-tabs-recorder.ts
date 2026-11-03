'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { generatedSurfaceRegistry } from '@clouddrive/surface/generated/composition';
import { useShellStore } from '../state/use-shell-store';
import { usePageTabsStore } from '../state/use-page-tabs-store';
import { useHydratedStore } from '@clouddrive/state-foundation/react';
/** 记录当前 pathname 的标签打开事件（app-shell 在导航提交时一并调用）。 */
export function usePageTabsRecorder(entries: ReadonlyArray<{ href: string; label: string }>): void {
  const pathname = usePathname();
  const hydrated = useHydratedStore(usePageTabsStore);
  const enabled = useShellStore((state) => state.preferences.navigation.pageTabsEnabled);
  const restoreLastTabs = useShellStore((state) => state.preferences.navigation.restoreLastTabs);
  const startedRef = useRef(false);
  useEffect(() => {
    if (!enabled || !hydrated) return;
    const valid = new Set([
      '/',
      ...Object.values(generatedSurfaceRegistry.routes).map((route) => route.pattern),
    ]);
    if (!valid.has(pathname)) return;
    if (!startedRef.current) {
      startedRef.current = true;
      if (!restoreLastTabs) usePageTabsStore.getState().resetTabs();
      else usePageTabsStore.getState().pruneTabs(valid);
    }
    let frame = 0;
    let recordedTitle: string | undefined;
    const record = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const heading = document.querySelector('.surface-route-content h1')?.textContent?.trim();
        const href = pathname + location.search;
        const title = heading || entries.find((entry) => entry.href === pathname)?.label;
        if (title && recordedTitle !== title + href) {
          recordedTitle = title + href;
          usePageTabsStore.getState().openTab({ pathname, href, title });
        }
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
  }, [pathname, entries, enabled, restoreLastTabs, hydrated]);
}

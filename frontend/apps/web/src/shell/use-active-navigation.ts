'use client';
import { useEffect, useRef } from 'react';
import type { NavigationGroup } from '@clouddrive/types';

/** 路由/导航模式提交后定位一次；随后把滚动控制权交还给用户。 */
export function useActiveNavigation(
  pathname: string,
  compact: boolean,
  model: readonly NavigationGroup[],
) {
  const ref = useRef<HTMLElement>(null);
  const intent = useRef({ pathname, compact, interacted: false });
  useEffect(() => {
    const viewport = ref.current;
    if (!viewport) return;
    if (intent.current.pathname !== pathname || intent.current.compact !== compact)
      intent.current = { pathname, compact, interacted: false };
    if (intent.current.interacted) return;
    let frame = 0;
    let done = false;
    const stop = () => {
      done = true;
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resize.disconnect();
    };
    const reveal = () => {
      frame = 0;
      if (done || !viewport.clientHeight) return;
      const current =
        viewport.querySelector<HTMLElement>('[aria-current="page"]') ??
        viewport.querySelector<HTMLElement>('button[data-active="true"]');
      if (!current) return;
      const item = current.getBoundingClientRect();
      if (!item.height || !item.width) return;
      const top = viewport.getBoundingClientRect().top + viewport.clientTop;
      const bottom = top + viewport.clientHeight;
      const delta =
        item.top < top ? item.top - top : item.bottom > bottom ? item.bottom - bottom : 0;
      // 只滚动导航自身；scrollIntoView 会连同外层文档一起滚动。
      if (delta) viewport.scrollBy({ top: delta, behavior: 'instant' });
      stop();
    };
    const schedule = () => {
      if (!done && !frame) frame = requestAnimationFrame(reveal);
    };
    const interact = () => {
      intent.current.interacted = true;
      stop();
    };
    // 导航树按需加载；移动抽屉还可能先挂载再获得可见尺寸。
    const mutations = new MutationObserver(schedule);
    const resize = new ResizeObserver(schedule);
    mutations.observe(viewport, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-current', 'data-active'],
    });
    resize.observe(viewport);
    viewport.addEventListener('pointerdown', interact, { passive: true });
    viewport.addEventListener('wheel', interact, { passive: true });
    viewport.addEventListener('keydown', interact);
    schedule();
    return () => {
      stop();
      viewport.removeEventListener('pointerdown', interact);
      viewport.removeEventListener('wheel', interact);
      viewport.removeEventListener('keydown', interact);
    };
  }, [pathname, compact, model]);
  return ref;
}

'use client';

import { MoreHorizontal, Pin, X } from 'lucide-react';
import { Action } from '@clouddrive/ui-adapter/action';
import { MenuButton } from '@clouddrive/ui-adapter/menu-button';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { rehydrateStore } from '@clouddrive/state-foundation';
import { usePageTabsStore } from '../state/use-page-tabs-store';
import { useShellStore } from '../state/use-shell-store';
import { proceedAfterLeaveConfirm } from '../host/leave-confirm';
import { markForwardRouteIntent, pageTransitionTypes } from '../host/route-transition-constants';
import { resolveScrollOption } from '../host/scroll-preference';
import { useNavigationTitle } from './use-navigation-title';

/**
 * Shell 顶部页面标签条（SET-005-002）。
 *
 * - 标签 = 页面入口（pathname 身份；筛选/排序变化不创建重复标签）；切换仍走
 *   Next Router（不缓存 React 页面树）；
 * - 页面入口提交时打开标签（更新当前目标，保持访问顺序，见 usePageTabsRecorder）；当前页高亮；X 关闭；
 * - **导航偏好 pageTabsEnabled 门控**（默认关 → 不显示条、不记录）；
 * - 会话级持久化（sessionStorage；restoreLastTabs=true 时本窗口刷新恢复，
 *   false 时挂载后清空陈旧会话标签——关闭记忆停止恢复但不删本地数据的语义
 *   由 clearIfDisabled 在挂载时执行一次）。
 */
export function PageTabs() {
  const { t } = useFrontendTranslation();
  const entranceTitle = useNavigationTitle();
  // Tabs describe the actual category/entity heading; only the renamed home entrance is canonical.
  const pageTitle = (href: string, recorded: string) =>
    href === '/' ? entranceTitle(href, recorded) : recorded;
  const pathname = usePathname();
  const router = useRouter();
  const pageTabsEnabled = useShellStore((state) => state.preferences.navigation.pageTabsEnabled);
  const tabs = usePageTabsStore((state) => state.tabs);
  const stripRef = useRef<HTMLDivElement>(null);
  const focusAfterClose = useRef(false);
  useEffect(() => {
    const strip = stripRef.current;
    const current = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !current) return;
    const reveal = () => {
      const bounds = current.getBoundingClientRect();
      const viewport = strip.getBoundingClientRect();
      if (bounds.left < viewport.left) strip.scrollLeft += bounds.left - viewport.left;
      else if (bounds.right > viewport.right) strip.scrollLeft += bounds.right - viewport.right;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [pathname, tabs, pageTabsEnabled]);
  useEffect(() => {
    if (!focusAfterClose.current) return;
    const current = stripRef.current?.querySelector<HTMLButtonElement>('[aria-current="page"]');
    if (!current) return;
    focusAfterClose.current = false;
    current.focus({ preventScroll: true });
  }, [pathname]);

  // 显式 hydration（skipHydration store）；restoreLastTabs=false 的会话清空由
  // usePageTabsRecorder 首个启用帧处理（避免与打开当前页竞态）。
  useEffect(() => {
    rehydrateStore(usePageTabsStore);
  }, []);

  // 关闭标签（SET-005-002 关闭策略）：若关闭的是当前激活标签，按偏好
  // tabCloseBehavior（最近/右邻/左邻）导航到目标；无目标 → 回默认首页（'/'）。
  const tabCloseBehavior = useShellStore((state) => state.preferences.navigation.tabCloseBehavior);
  // 单个标签的显式操作（固定/关闭/关闭两侧/刷新）。固定标签不会被关闭类操作移除。
  const runTabAction = async (action: string, tabPathname: string) => {
    const store = usePageTabsStore.getState();
    if (action === 'pin' || action === 'unpin') {
      store.setPinned(tabPathname, action === 'pin');
      return;
    }
    if (action === 'refresh') {
      if (tabPathname === pathname) router.refresh();
      return;
    }
    if (action === 'close-others') {
      store.closeOtherTabs(tabPathname);
      return;
    }
    if (action === 'close-left') {
      store.closeTabsBeside(tabPathname, 'left');
      return;
    }
    if (action === 'close-right') {
      store.closeTabsBeside(tabPathname, 'right');
      return;
    }
    if (action === 'close-all') {
      store.closeAllTabs();
      if (tabPathname === pathname && !tabs.find((tab) => tab.pathname === pathname)?.pinned) {
        markForwardRouteIntent();
        router.push('/', resolveScrollOption());
      }
      return;
    }
    await closeTabAt(tabPathname);
  };
  const closeTabAt = async (closedPathname: string) => {
    if (tabs.find((tab) => tab.pathname === closedPathname)?.pinned) return;
    const closingActive = closedPathname === pathname;
    const closingIndex = tabs.findIndex((tab) => tab.pathname === closedPathname);
    const target = (() => {
      if (!closingActive) return null;
      if (tabCloseBehavior === 'recent') {
        const other = tabs
          .filter((tab) => tab.pathname !== closedPathname)
          .sort((a, b) => b.activatedAt - a.activatedAt)[0];
        return other?.href ?? other?.pathname ?? '/';
      }
      if (tabCloseBehavior === 'right') {
        const right = tabs[closingIndex + 1] ?? tabs[closingIndex - 1];
        return right ? (right.href ?? right.pathname) : '/';
      }
      const left = tabs[closingIndex - 1] ?? tabs[closingIndex + 1];
      return left ? (left.href ?? left.pathname) : '/';
    })();
    if (
      closingActive &&
      target &&
      target !== pathname &&
      !(await proceedAfterLeaveConfirm(target, t('shell.pageTabs')))
    )
      return;
    if (closingActive) focusAfterClose.current = true;
    else
      stripRef.current
        ?.querySelector<HTMLButtonElement>('[aria-current="page"]')
        ?.focus({ preventScroll: true });
    usePageTabsStore.getState().closeTab(closedPathname);
    if (closingActive) {
      if (target && target !== pathname) {
        markForwardRouteIntent();
        void router.push(target, {
          transitionTypes: [pageTransitionTypes.forward],
          ...resolveScrollOption(),
        });
      } else if (target === '/') {
        void router.push('/', {
          transitionTypes: [pageTransitionTypes.forward],
          ...resolveScrollOption(),
        });
      }
    }
  };

  if (!pageTabsEnabled) return null;

  return (
    <nav
      aria-label={t('shell.pageTabs')}
      className="flex min-w-0 items-center gap-2 border-b border-border bg-surface px-3"
    >
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto" ref={stripRef}>
        {tabs.length === 0 ? (
          <span className="px-2 py-2 text-xs text-ink-muted">{t('shell.noPageTabs')}</span>
        ) : (
          tabs.map((tab) => {
            const active = tab.pathname === pathname;
            return (
              <div
                className={`group ${active ? 'inline-flex' : 'hidden md:inline-flex'} min-w-0 max-w-full shrink-0 items-center gap-1 border-b-2 px-2 py-1.5 text-sm ${
                  active
                    ? 'border-brand font-semibold text-brand'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
                key={tab.pathname}
              >
                <button
                  aria-current={active ? 'page' : undefined}
                  title={pageTitle(tab.href ?? tab.pathname, tab.title)}
                  className="min-h-control min-w-0 max-w-40 truncate rounded-control px-1 outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  onClick={() => {
                    if (tab.pathname === pathname) return;
                    void proceedAfterLeaveConfirm(
                      tab.href ?? tab.pathname,
                      t('shell.pageTabs'),
                    ).then((proceed) => {
                      if (!proceed) return;
                      markForwardRouteIntent();
                      void router.push(tab.href ?? tab.pathname, {
                        transitionTypes: [pageTransitionTypes.forward],
                        ...resolveScrollOption(),
                      });
                    });
                  }}
                  type="button"
                >
                  {pageTitle(tab.href ?? tab.pathname, tab.title)}
                </button>
                {tab.pinned ? (
                  <span className="text-brand" title={t('shell.tabActions.pinned')}>
                    <Pin aria-hidden="true" className="size-3.5" />
                    <span className="sr-only">{t('shell.tabActions.pinned')}</span>
                  </span>
                ) : null}
                <span
                  className={
                    active
                      ? 'text-ink-muted'
                      : 'opacity-60 group-hover:opacity-100 group-focus-within:opacity-100'
                  }
                >
                  {tab.pinned ? null : (
                    <Action
                      variant="quiet"
                      size="md"
                      onPress={() => {
                        void closeTabAt(tab.pathname);
                      }}
                    >
                      <span className="sr-only">
                        {t('shell.closeTab', {
                          title: pageTitle(tab.href ?? tab.pathname, tab.title),
                        })}
                      </span>
                      <X aria-hidden="true" className="size-4" />
                    </Action>
                  )}
                  <MenuButton
                    ariaLabel={t('shell.tabActions.label', {
                      title: pageTitle(tab.href ?? tab.pathname, tab.title),
                    })}
                    items={[
                      {
                        id: tab.pinned ? 'unpin' : 'pin',
                        label: t(tab.pinned ? 'shell.tabActions.unpin' : 'shell.tabActions.pin'),
                      },
                      {
                        id: 'close',
                        label: t('shell.tabActions.close'),
                        disabled: Boolean(tab.pinned),
                      },
                      { id: 'close-others', label: t('shell.tabActions.closeOthers') },
                      { id: 'close-left', label: t('shell.tabActions.closeLeft') },
                      { id: 'close-right', label: t('shell.tabActions.closeRight') },
                      { id: 'close-all', label: t('shell.tabActions.closeAll') },
                      { id: 'refresh', label: t('shell.tabActions.refresh') },
                    ]}
                    label={<MoreHorizontal aria-hidden="true" className="size-4" />}
                    onAction={(action) => {
                      void runTabAction(action, tab.pathname);
                    }}
                  />
                </span>
              </div>
            );
          })
        )}
      </div>
      {tabs.length > 0 ? (
        <div className="ml-auto shrink-0">
          <MenuButton
            label={t('shell.morePages', { count: tabs.length })}
            ariaLabel={t('shell.pageTabs')}
            items={[
              ...tabs.map((tab) => ({
                id: tab.pathname,
                label: pageTitle(tab.href ?? tab.pathname, tab.title),
                ...(tab.pathname === pathname ? { description: t('shell.currentPage') } : {}),
              })),
              { id: 'close-others', label: t('shell.closeOtherTabs'), disabled: tabs.length < 2 },
            ]}
            onAction={(id) => {
              if (id === 'close-others') {
                usePageTabsStore.getState().closeOtherTabs(pathname);
                return;
              }
              const tab = tabs.find((tab) => tab.pathname === id);
              const href = tab?.href ?? id;
              void proceedAfterLeaveConfirm(href, t('shell.pageTabs')).then((proceed) => {
                if (proceed) {
                  markForwardRouteIntent();
                  router.push(href, resolveScrollOption());
                }
              });
            }}
          />
        </div>
      ) : null}
    </nav>
  );
}

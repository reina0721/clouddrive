'use client';

import { flattenNavigationLeaves } from '@clouddrive/core';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { PluginLocaleProvider } from '@clouddrive/plugin-framework/plugin';
import { ShellRoot } from '@clouddrive/surface-foundation/shell-navigation';
import type { NavigationGroup, NavigationNode } from '@clouddrive/types';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { Skeleton } from '@clouddrive/ui-adapter/skeleton';
import {
  Languages,
  Lock,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  Sun,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { NotificationAlerts } from '../host/notification-alerts';
import { useDesktopNotificationGate } from '../host/use-desktop-notification';

import { useCommandsPort } from '@clouddrive/plugin-framework/commands';
import { DrawerSurface } from '@clouddrive/ui-adapter/overlays';
import { useAuth } from '../auth/context';
import { proceedAfterLeaveConfirm } from '../host/leave-confirm';
import { HostNavigationPortProvider } from '../host/navigation-port';
import { useRecentVisitRecorder } from '../host/recent-visit-recorder';
import { routeTargetResolver } from '../host/route-target-resolver';
import { RouteTransition } from '../host/route-transition';
import { markForwardRouteIntent, pageTransitionTypes } from '../host/route-transition-constants';
import { resolveScrollOption } from '../host/scroll-preference';
import { TopProgress } from '../host/top-progress';
import { useShellStore } from '../state/use-shell-store';
import { BrandMark } from './brand-mark';
import { CurrentSiteLogo, useSiteProfile } from '@clouddrive/surface/administration/runtime';
import { HeaderNavigation } from './header-navigation';
import { NotificationCenter } from './notification-center';
import { usePageTabsRecorder } from './use-page-tabs-recorder';
import { useNavigationLabelOverrides, useProductNavigation } from './use-product-navigation';
import { WatermarkOverlay } from './watermark';

const NavigationTree = lazy(() =>
  import('./navigation-tree').then((module) => ({ default: module.NavigationTree })),
);

const subscribeDesktop = (notify: () => void) => {
  window.addEventListener('resize', notify);
  return () => window.removeEventListener('resize', notify);
};
const desktopSnapshot = () => window.innerWidth >= 768;

const AccountMenu = dynamic(() => import('./account-menu').then((module) => module.AccountMenu), {
  ssr: false,
  loading: () => <Skeleton className="h-control w-control md:w-28" />,
});
const PageTabs = dynamic(() => import('./page-tabs').then((module) => module.PageTabs), {
  ssr: false,
  loading: () => <Skeleton className="h-control w-full" />,
});

const CommandMenu = dynamic(
  () => import('@clouddrive/ui-adapter/command-menu').then((module) => module.CommandMenu),
  { ssr: false },
);

/** 快捷偏好抽屉与锁屏只在需要时加载：不把表单控件/Drawer 依赖打进每个页面的首屏 JS。 */
const QuickPreferencesDrawer = dynamic(
  () => import('./quick-preferences-drawer').then((module) => module.QuickPreferencesDrawer),
  { ssr: false },
);

function NavigationContent({
  groups: navigationGroups,
  onNavigate,
  compact = false,
  labelOverrides,
}: {
  groups: readonly NavigationGroup[];
  onNavigate?: () => void;
  compact?: boolean;
  labelOverrides?: Readonly<Record<string, string>>;
}) {
  const { t } = useFrontendTranslation();
  const { profile } = useSiteProfile();

  return (
    <>
      <div
        className={`flex h-20 shrink-0 items-center border-b border-border ${compact ? 'justify-center px-3' : 'gap-3 px-5'}`}
      >
        <CurrentSiteLogo className="size-9 shrink-0" fallback={<BrandMark />} />
        {compact ? null : (
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold tracking-tight text-ink">
              {profile?.name || t('brand.name')}
            </p>
            <p className="truncate text-xs text-ink-muted">{t('brand.edition')}</p>
          </div>
        )}
      </div>
      <nav
        className={`surface-shell-navigation-viewport min-h-0 flex-1 py-6 ${compact ? 'surface-shell-compact-rail flex flex-col items-center px-3' : 'space-y-7 px-3'}`}
        aria-label={t('shell.primaryNav')}
      >
        <Suspense
          fallback={navigationGroups.map((group) => (
            <div
              key={group.id}
              className={
                compact ? 'surface-shell-compact-group w-control-lg space-y-1' : 'space-y-1'
              }
              aria-busy="true"
            >
              {compact ? null : <Skeleton className="mb-2 h-4 w-24" />}
              {group.items.map((item) => (
                <Skeleton
                  key={item.id}
                  className={compact ? 'mx-auto h-control-lg w-control-lg' : 'h-10 w-full'}
                />
              ))}
            </div>
          ))}
        >
          <NavigationTree
            compact={compact}
            groups={navigationGroups}
            {...(labelOverrides ? { labelOverrides } : {})}
            {...(onNavigate ? { onNavigate } : {})}
          />
        </Suspense>
      </nav>
    </>
  );
}

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  useDesktopNotificationGate();
  const shellRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const pageTabsPinned = useShellStore((state) => state.preferences.navigation.pageTabsPinned);
  const pageTabsEnabled = useShellStore((state) => state.preferences.navigation.pageTabsEnabled);
  const layoutMode = useShellStore((state) => state.preferences.navigation.layoutMode);
  const watermarkEnabled = useShellStore((state) => state.preferences.security.watermark);
  const watermarkText = useShellStore((state) => state.preferences.security.watermarkText);
  const auth = useAuth();
  const pathname = usePathname();
  const [quickPreferencesOpen, setQuickPreferencesOpen] = useState(false);
  useEffect(() => {
    const chrome = chromeRef.current;
    const shell = shellRef.current;
    if (!chrome || !shell) return;
    const measure = () =>
      shell.style.setProperty(
        '--shell-chrome-height',
        `${chrome.getBoundingClientRect().height}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(chrome);
    return () => observer.disconnect();
  }, []);
  const navigationGroups = useProductNavigation();
  // 菜单管理的标题覆盖与导航同源（页签/命令面板/侧栏共享同一份解析）。
  const labelOverrides = useNavigationLabelOverrides();
  // 当前路由所属分组（顶部/混合布局的分组切换与高亮依据）。
  const activeGroupId = useMemo(() => {
    const match = navigationGroups.find((group) =>
      flattenNavigationLeaves(group.items as readonly NavigationNode[]).some(({ leaf }) =>
        leaf.href === '/'
          ? pathname === '/'
          : pathname === leaf.href || pathname.startsWith(`${leaf.href}/`),
      ),
    );
    return match?.id ?? navigationGroups[0]?.id ?? null;
  }, [navigationGroups, pathname]);
  const [groupChoice, setGroupChoice] = useState<{ pathname: string; groupId: string } | null>(
    null,
  );
  // 真实路由变化后自动回到"跟随当前页面分组"，不保留手工探索状态（派生比较，无需 effect）。
  const mixedGroupId = groupChoice?.pathname === pathname ? groupChoice.groupId : activeGroupId;
  const sidebarGroups =
    layoutMode === 'mixed'
      ? navigationGroups.filter((group) => group.id === mixedGroupId)
      : navigationGroups;
  const { t } = useFrontendTranslation();
  const router = useRouter();
  const desktopTools = useSyncExternalStore(subscribeDesktop, desktopSnapshot, () => false);
  const theme = useShellStore((state) => state.theme);
  const locale = useShellStore((state) => state.locale);
  const mobileNavigationOpen = useShellStore((state) => state.mobileNavigationOpen);
  const sidebarCollapsed = useShellStore((state) => state.sidebarCollapsed);
  const setTheme = useShellStore((state) => state.setTheme);
  const setLocale = useShellStore((state) => state.setLocale);
  const setMobileNavigationOpen = useShellStore((state) => state.setMobileNavigationOpen);
  const setSidebarCollapsed = useShellStore((state) => state.setSidebarCollapsed);
  const shortcutsEnabled = useShellStore((state) => state.preferences.shortcuts.enabled);
  const commandsPort = useCommandsPort();
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1024) setMobileNavigationOpen(false);
    };
    window.addEventListener('resize', closeOnDesktop);
    return () => window.removeEventListener('resize', closeOnDesktop);
  }, [setMobileNavigationOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 输入框/IME 组合期间避让普通导航/命令快捷键。
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target?.isContentEditable ?? false) ||
        event.isComposing;
      if (!shortcutsEnabled || isTyping) return;
      // Ctrl/Cmd+K：命令菜单（保留既有组合）。
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      // 统一 Alt+Shift 组合 → 命令（同一执行函数与可用性，经 commandsPort.runCommand）。
      if (event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === 'n') {
          event.preventDefault();
          const result = commandsPort.runCommand('reference-resources.new');
          if (!result.ok) setCommandOpen(true); // 不可用时退回命令菜单呈现原因。
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcutsEnabled, commandsPort]);

  const registeredCommands = useSyncExternalStore(
    (onChange) => commandsPort.subscribe(onChange),
    () => commandsPort.listCommands(),
    () => commandsPort.listCommands(),
  );

  const commandItems = useMemo(() => {
    const navItems = navigationGroups.flatMap((group) =>
      flattenNavigationLeaves(group.items as readonly NavigationNode[]).map(
        ({ leaf, ancestors }) => ({
          id: leaf.href,
          label: labelOverrides[leaf.labelKey] ?? t(leaf.labelKey),
          description: [
            t(group.labelKey),
            ...ancestors.map((ancestor) => t(ancestor.labelKey)),
          ].join(' / '),
        }),
      ),
    );
    // 注册命令（global/page）并入命令菜单：id 前缀 `command:` 与导航 href 区分。
    const commandItemsFromRegistry = registeredCommands.map((command) => ({
      id: `command:${command.id}`,
      label: command.label,
      description: command.description,
    }));
    return [...navItems, ...commandItemsFromRegistry];
  }, [t, registeredCommands, navigationGroups, labelOverrides]);

  // 页面入口 href → 标题（供 recents 记录消费；i18n 解析后 memo，保持引用稳定）。
  const navEntries = useMemo(
    () =>
      flattenNavigationLeaves(
        navigationGroups.flatMap((group) => group.items as readonly NavigationNode[]),
      ).map(({ leaf }) => ({
        href: leaf.href,
        label: labelOverrides[leaf.labelKey] ?? t(leaf.labelKey),
      })),
    [t, navigationGroups, labelOverrides],
  );
  // 最近访问记录：pathname 页面入口提交时写入 Workbench recents（SET-005-004 消费）。
  useRecentVisitRecorder(navEntries);
  // 页面标签记录：同一提交同时打开顶部标签（pageTabsEnabled 门控）。
  usePageTabsRecorder(navEntries);

  return (
    <ShellRoot
      collapsed={sidebarCollapsed}
      layout={layoutMode === 'horizontal' ? 'horizontal' : 'vertical'}
    >
      <NotificationAlerts />
      <TopProgress />
      {watermarkEnabled ? (
        <WatermarkOverlay
          detail={watermarkText.trim() || t('brand.edition')}
          identity={
            auth.session?.user
              ? `${auth.session.user.name} · ${auth.session.user.email}`
              : t('brand.name')
          }
        />
      ) : null}
      {layoutMode !== 'horizontal' ? (
        <aside className="sticky top-0 hidden h-screen min-w-0 flex-col border-r border-border bg-surface lg:flex">
          <NavigationContent
            groups={sidebarGroups}
            compact={sidebarCollapsed}
            labelOverrides={labelOverrides}
          />
        </aside>
      ) : null}

      <DrawerSurface
        triggerLabel={t('shell.menu')}
        title={t('shell.primaryNav')}
        description={t('brand.edition')}
        closeLabel={t('shell.closeNav')}
        isOpen={mobileNavigationOpen}
        onOpenChange={setMobileNavigationOpen}
        placement="left"
        composition="navigation"
      >
        <NavigationContent
          groups={navigationGroups}
          labelOverrides={labelOverrides}
          onNavigate={() => setMobileNavigationOpen(false)}
        />
      </DrawerSurface>

      <div className="min-w-0" ref={shellRef}>
        <div className="sticky top-0 z-sticky" ref={chromeRef}>
          <header className="flex h-20 items-center gap-3 border-b border-border bg-canvas/90 px-4 backdrop-blur-xl sm:px-6 xl:px-8">
            <div className="lg:hidden">
              <IconAction label={t('shell.menu')} onPress={() => setMobileNavigationOpen(true)}>
                <Menu className="size-5" />
              </IconAction>
            </div>
            {layoutMode === 'vertical' ? (
              <div className="hidden lg:block" data-navigation-control>
                <IconAction
                  label={sidebarCollapsed ? t('shell.expandSidebar') : t('shell.collapseSidebar')}
                  onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
                >
                  {sidebarCollapsed ? (
                    <PanelLeftOpen className="size-4.5" />
                  ) : (
                    <PanelLeftClose className="size-4.5" />
                  )}
                </IconAction>
              </div>
            ) : null}
            {layoutMode !== 'vertical' ? (
              <div className="hidden min-w-0 lg:block">
                <HeaderNavigation
                  activeGroupId={mixedGroupId}
                  groups={navigationGroups}
                  mode={layoutMode}
                  onGroupSelect={(groupId) => setGroupChoice({ pathname, groupId })}
                />
              </div>
            ) : null}
            <div className="md:hidden">
              <IconAction label={t('shell.search')} onPress={() => setCommandOpen(true)}>
                <Search className="size-5" />
              </IconAction>
            </div>
            <div className="min-w-0 md:flex-1">
              <CommandMenu
                hideTrigger={!desktopTools}
                defaultOpen={false}
                emptyLabel={t('shell.commandEmpty')}
                isOpen={commandOpen}
                items={commandItems}
                searchLabel={t('shell.commandSearchLabel')}
                searchPlaceholder={t('shell.search')}
                title={t('shell.commandTitle')}
                triggerLabel={t('shell.searchShortcut')}
                onAction={(id) => {
                  setCommandOpen(false);
                  if (id.startsWith('command:')) {
                    // 命令执行（同一执行函数与可用性；不可用不执行）。
                    commandsPort.runCommand(id.slice('command:'.length));
                    return;
                  }
                  void proceedAfterLeaveConfirm(id, t('shell.search')).then((proceed) => {
                    if (!proceed) return;
                    markForwardRouteIntent();
                    void router.push(id, {
                      transitionTypes: [pageTransitionTypes.forward],
                      ...resolveScrollOption(),
                    });
                  });
                }}
                onOpenChange={setCommandOpen}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden items-center gap-2 md:flex">
                <IconAction
                  label={t('shell.quickPreferences.open')}
                  onPress={() => setQuickPreferencesOpen(true)}
                >
                  <Settings2 className="size-4.5" />
                </IconAction>
                <IconAction
                  label={t('shell.lock.action')}
                  onPress={() => window.dispatchEvent(new Event('clouddrive:lock'))}
                >
                  <Lock className="size-4.5" />
                </IconAction>
                <IconAction
                  label={t('shell.locale')}
                  onPress={() => setLocale(locale === 'zh-CN' ? 'en' : 'zh-CN')}
                >
                  <Languages className="size-4.5" />
                </IconAction>
                <IconAction
                  label={t('shell.theme')}
                  onPress={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                >
                  {theme === 'light' ? <Moon className="size-4.5" /> : <Sun className="size-4.5" />}
                </IconAction>
              </div>
              <NotificationCenter />
              <AccountMenu
                compact={!desktopTools}
                onNavigate={(destination) => {
                  if (destination === 'lock-screen') {
                    window.dispatchEvent(new Event('clouddrive:lock'));
                    return;
                  }
                  const href = routeTargetResolver.resolveHref({
                    routeId: destination,
                    params: {},
                  });
                  void proceedAfterLeaveConfirm(href, t('shell.account')).then((proceed) => {
                    if (!proceed) return;
                    markForwardRouteIntent();
                    void router.push(href, {
                      transitionTypes: [pageTransitionTypes.forward],
                      ...resolveScrollOption(),
                    });
                  });
                }}
              />
            </div>
          </header>
          {pageTabsEnabled && pageTabsPinned ? <PageTabs /> : null}
        </div>
        {pageTabsEnabled && !pageTabsPinned ? <PageTabs /> : null}
        <main className="mx-auto max-w-screen-2xl p-4 sm:p-6 xl:p-8" id="main-content">
          <RouteTransition>
            <PluginLocaleProvider
              port={{
                locale,
                changeLocale: (next) => {
                  if (next === 'en' || next === 'zh-CN') setLocale(next);
                },
              }}
            >
              <HostNavigationPortProvider resolveHref={routeTargetResolver.resolveHref}>
                {children}
              </HostNavigationPortProvider>
            </PluginLocaleProvider>
          </RouteTransition>
        </main>
      </div>
      <QuickPreferencesDrawer open={quickPreferencesOpen} onOpenChange={setQuickPreferencesOpen} />
    </ShellRoot>
  );
}

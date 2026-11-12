'use client';

import { FeedbackProvider } from '@clouddrive/ui-adapter/feedback-provider';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { AlertTriangle } from 'lucide-react';
import { FrontendI18nProvider, useFrontendTranslation } from '@clouddrive/i18n';
import { ControlLocaleProvider } from '@clouddrive/ui-adapter/accessibility';
import { CommandsProvider } from '@clouddrive/plugin-framework/commands';
import { LeaveConfirmProvider } from '@clouddrive/plugin-framework/leave-confirm';
import { NotificationsProvider } from '@clouddrive/plugin-framework/notifications';
import { PreferencesProvider } from '@clouddrive/plugin-framework/preferences';
import { WorkspaceProvider } from '@clouddrive/plugin-framework/workspace';
import { WorkbenchProvider } from '@clouddrive/plugin-framework/workbench';
import { rehydrateStore } from '@clouddrive/state-foundation';
import { ScrollRevealRuntime } from './scroll-reveal-runtime';
import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';

import { appI18n } from '../i18n/i18n';
import { TOAST_DURATION_MS } from '@clouddrive/surface/preferences-model';
import { useNotificationsStore } from '../state/use-notifications-store';
import { useShellStore } from '../state/use-shell-store';
import { useWorkbenchStore } from '../state/use-workbench-store';
import { useWorkspaceStore } from '../state/use-workspace-store';
import { AppLoadingSurface } from './app-loading-surface';
import { createHostCommandsPort } from './commands-port';
import { GlobalProgressProvider } from './global-progress-provider';
import { NavigationAdminPortProvider } from './navigation-admin-port';
import { LeaveConfirmationGuard } from './leave-confirm-dialog';
import { createHostLeaveConfirmPort } from './leave-confirm-port';
import { MotionPolicyProvider } from './motion-policy';
import { createHostNotificationsPort } from './notifications-port';
import { createHostPreferencesPort } from './preferences-port';
import { createHostWorkbenchPort } from './workbench-port';
import { createHostWorkspacePort } from './workspace-port';
import { focusRouteAnchor } from './anchor-focus';
import { RuntimeSiteProfile } from './site-profile-provider';

const darkSchemeQuery = '(prefers-color-scheme: dark)';

function subscribeSystemDark(onChange: () => void) {
  const query = window.matchMedia(darkSchemeQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function readSystemDark() {
  return window.matchMedia(darkSchemeQuery).matches;
}

function RuntimeProviders({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useFrontendTranslation();
  const preferences = useShellStore((state) => state.preferences);
  const hasHydrated = useShellStore((state) => state.hasHydrated);
  const workspaceHasHydrated = useWorkspaceStore((state) => state.hasHydrated);
  const hydrationIssue = useShellStore((state) => state.hydrationIssue);
  const initialAnchorHandled = useRef(false);

  useEffect(() => {
    if (!hasHydrated || !workspaceHasHydrated || initialAnchorHandled.current) return;
    initialAnchorHandled.current = true;
    // 冷启动的 DOM 在 hydration 后才出现；复用导航 Port 的同源定位/焦点机制。
    // 仅初始 hash，不重置无锚点页面，也不接管后退或之后的分类导航。
    if (location.hash) focusRouteAnchor(location.href);
  }, [hasHydrated, workspaceHasHydrated]);

  const systemDark = useSyncExternalStore(subscribeSystemDark, readSystemDark, () => false);
  const themeMode = preferences.appearance.themeMode;
  const accent = preferences.appearance.accent;
  const locale = preferences.localeRegion.language;
  const toastDurationMs = TOAST_DURATION_MS[preferences.notifications.toastDuration];
  // themeMode=system → 跟随系统深浅色；显式 light|dark 直接使用（旧用户值经 migrate 保留）。
  const resolvedTheme = themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode;

  // 经 state-foundation hydration lifecycle 幂等触发（正式 lifecycle；hasHydrated 由
  // shell store 的 onRehydrateStorage 设置，语义与迁移前一致）。
  useEffect(() => {
    rehydrateStore(useShellStore);
    rehydrateStore(useWorkbenchStore);
    rehydrateStore(useNotificationsStore);
    rehydrateStore(useWorkspaceStore);
  }, []);

  // Workbench 记录开关绑定导航偏好（rememberRecents）：设置页改动即时生效。
  useEffect(() => {
    if (!hasHydrated) return;
    useWorkbenchStore.getState().setRememberRecents(preferences.navigation.rememberRecents);
  }, [hasHydrated, preferences.navigation.rememberRecents]);

  // Preferences Port 单例（composition root）：跨窗口 storage 同步随 hydration 后启动。
  const preferencesPort = useMemo(() => createHostPreferencesPort(), []);
  const leaveConfirmPort = useMemo(() => createHostLeaveConfirmPort(), []);
  const notificationsPort = useMemo(() => createHostNotificationsPort(), []);
  const commandsPort = useMemo(() => createHostCommandsPort(), []);
  const workspacePort = useMemo(() => createHostWorkspacePort(), []);
  const workbenchPort = useMemo(() => createHostWorkbenchPort(), []);
  useEffect(() => {
    if (!hasHydrated) return undefined;
    return preferencesPort.startCrossWindowSync();
  }, [hasHydrated, preferencesPort]);

  useEffect(() => {
    if (!hasHydrated) return;
    let firstFrame = 0;
    let stableFrame = 0;
    let cancelled = false;
    const html = document.documentElement;

    // 展示策略写 data-*：主题/强调色（token 由 design-system 生成）+ 密度/字号/
    // 内容宽度/对比度（tokens.css 保留外层 data-* 覆盖；标准档 = 默认不做覆盖，
    // 仍写值便于诊断）。
    html.dataset.theme = resolvedTheme;
    html.dataset.accent = accent;
    html.dataset.density = preferences.appearance.density;
    html.dataset.fontScale = preferences.appearance.fontScale;
    html.dataset.contentWidth = preferences.appearance.contentWidth;
    html.dataset.contrast = preferences.appearance.contrast;
    // 色弱 / 灰阶辅助：纯视觉滤镜（tokens.css 保留外层 data-* 覆盖），默认 off。
    html.dataset.colorWeak = preferences.appearance.colorWeak ? 'on' : 'off';
    html.dataset.grayscale = preferences.appearance.grayscale ? 'on' : 'off';
    // 页面切换动画（117）：由 Surface Foundation 的 Screen Recipe 消费；
    // `default` 保持项目现行方向进入，其余值对应 Vben 页面切换集合。
    html.dataset.pageTransition = preferences.appearance.pageTransition;
    // 可访问性增强（默认关；只增强）：焦点轮廓 / 交互区域尺寸 data-* → tokens.css
    // 保留外层覆盖；跟随系统辅助设置 → 监听 prefers-contrast 写 data-system-contrast。
    html.dataset.enhanceFocus = preferences.accessibility.enhanceFocus ? 'on' : 'off';
    html.dataset.enhanceTarget = preferences.accessibility.enhanceTargetSize ? 'on' : 'off';
    html.dataset.followSystem = preferences.accessibility.followSystemAssistive ? 'on' : 'off';
    const contrastQuery =
      typeof window !== 'undefined' ? window.matchMedia('(prefers-contrast: more)') : null;
    const applySystemContrast = () => {
      if (
        preferences.appearance.contrast !== 'system' &&
        !preferences.accessibility.followSystemAssistive
      ) {
        delete html.dataset.systemContrast;
        return;
      }
      html.dataset.systemContrast = contrastQuery?.matches ? 'more' : 'standard';
    };
    applySystemContrast();
    contrastQuery?.addEventListener('change', applySystemContrast);
    html.lang = locale;
    delete html.dataset.hydrated;
    void appI18n.changeLocale(locale).then(() => {
      if (cancelled) return;
      firstFrame = requestAnimationFrame(() => {
        stableFrame = requestAnimationFrame(() => {
          if (!cancelled) html.dataset.hydrated = 'true';
        });
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(stableFrame);
      contrastQuery?.removeEventListener('change', applySystemContrast);
    };
  }, [
    hasHydrated,
    locale,
    resolvedTheme,
    accent,
    preferences.appearance.density,
    preferences.appearance.fontScale,
    preferences.appearance.contentWidth,
    preferences.appearance.contrast,
    preferences.appearance.colorWeak,
    preferences.appearance.grayscale,
    preferences.appearance.pageTransition,
    preferences.accessibility.enhanceFocus,
    preferences.accessibility.enhanceTargetSize,
    preferences.accessibility.followSystemAssistive,
  ]);

  return (
    <RuntimeSiteProfile theme={resolvedTheme}>
      {!hasHydrated || !workspaceHasHydrated ? (
        <AppLoadingSurface label="正在加载应用 / Loading application" />
      ) : (
        <PreferencesProvider port={preferencesPort}>
          <NavigationAdminPortProvider>
            <WorkspaceProvider port={workspacePort}>
              <WorkbenchProvider port={workbenchPort}>
                <CommandsProvider port={commandsPort}>
                  <NotificationsProvider port={notificationsPort}>
                    <LeaveConfirmProvider port={leaveConfirmPort}>
                      <LeaveConfirmationGuard>
                        <FeedbackProvider
                          closeLabel={t('common.close')}
                          loadingLabel={t('common.feedbackLoading')}
                          toastDurationMs={toastDurationMs}
                        >
                          {hydrationIssue ? (
                            <div className="mx-auto max-w-screen-2xl p-4 sm:p-6 xl:p-8">
                              <AlertBanner
                                actionLabel={t('shell.recoverDefaults')}
                                announcement="urgent"
                                description={hydrationIssue.reason}
                                icon={<AlertTriangle className="size-4" aria-hidden="true" />}
                                onAction={() => {
                                  // 恢复默认：清除损坏记录并重载（不触碰收藏/通知/草稿等
                                  // 独立 Store）。
                                  window.localStorage.removeItem('clouddrive.shell');
                                  window.location.reload();
                                }}
                                title={t('shell.hydrationIssueTitle')}
                                tone="warning"
                              />
                            </div>
                          ) : null}
                          {children}
                        </FeedbackProvider>
                      </LeaveConfirmationGuard>
                    </LeaveConfirmProvider>
                  </NotificationsProvider>
                </CommandsProvider>
              </WorkbenchProvider>
            </WorkspaceProvider>
          </NavigationAdminPortProvider>
        </PreferencesProvider>
      )}
    </RuntimeSiteProfile>
  );
}

function LocalizedControls({ children }: Readonly<{ children: ReactNode }>) {
  const { locale } = useFrontendTranslation();
  const weekStart = useShellStore((state) => state.preferences.localeRegion.weekStart);
  return (
    <ControlLocaleProvider locale={locale} weekStart={weekStart}>
      {children}
    </ControlLocaleProvider>
  );
}

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  // 用户动效偏好（外观 → motion）：订阅 shell store；hydration 完成后即时生效。
  // MotionPolicyProvider 收到 reduced/standard 时硬设 data-motion-mode（Inspector
  // 不得覆盖用户更强的减少动效要求）；system 走 Inspector/OS 原逻辑。
  const motionPreference = useShellStore((state) => state.preferences.appearance.motion);
  return (
    <FrontendI18nProvider runtime={appI18n}>
      <LocalizedControls>
        <MotionPolicyProvider preference={motionPreference}>
          <ScrollRevealRuntime>
            <GlobalProgressProvider>
              <RuntimeProviders>{children}</RuntimeProviders>
            </GlobalProgressProvider>
          </ScrollRevealRuntime>
        </MotionPolicyProvider>
      </LocalizedControls>
    </FrontendI18nProvider>
  );
}

import { render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { defaultPreferences, PREFERENCES_VERSION } from '@clouddrive/surface/preferences-model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../host/providers';
import { appI18n } from '../i18n/i18n';
import { useShellStore } from '../state/use-shell-store';

function LocaleProbe() {
  const { locale } = useFrontendTranslation();
  return <p>{locale}</p>;
}

describe('AppProviders hydration（clouddrive.shell v0 → v1）', () => {
  beforeEach(async () => {
    localStorage.clear();
    useShellStore.setState({
      preferences: defaultPreferences,
      theme: 'light',
      locale: 'zh-CN',
      hasHydrated: false,
      mobileNavigationOpen: false,
      sidebarCollapsed: false,
    });
    await appI18n.changeLocale('zh-CN');
    document.documentElement.lang = 'zh-CN';
    document.documentElement.dataset.theme = 'light';
    delete document.documentElement.dataset.accent;
    delete document.documentElement.dataset.hydrated;
  });

  afterEach(async () => {
    await appI18n.changeLocale('zh-CN');
    document.body.innerHTML = '';
  });

  it('hydration 恢复 v0 持久化偏好（保真迁移为 v1 嵌套）并应用展示策略', async () => {
    const element = (
      <AppProviders>
        <LocaleProbe />
      </AppProviders>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(element);
    document.body.append(container);
    expect(container).toHaveTextContent('正在加载应用 / Loading application');
    // v0 平铺记录（迁移前形状）：显式 dark/en/collapsed 应保真映射进嵌套偏好。
    localStorage.setItem(
      'clouddrive.shell',
      JSON.stringify({
        state: { theme: 'dark', locale: 'en', sidebarCollapsed: true },
        version: 0,
      }),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(element, { container, hydrate: true });

    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-hydrated', 'true'));
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-accent', 'purple');
    expect(screen.getByText('en')).toBeVisible();
    // v0 显式 dark → themeMode=dark；collapsed → sidebarBehavior=collapsed（不套新默认）。
    const prefs = useShellStore.getState().preferences;
    expect(prefs.appearance.themeMode).toBe('dark');
    expect(prefs.localeRegion.language).toBe('en');
    expect(prefs.navigation.sidebarBehavior).toBe('collapsed');
    // migrate 后 zustand persist 以 version 1 回写（下次读取不再 migrate）。
    const stored = JSON.parse(localStorage.getItem('clouddrive.shell') ?? 'null') as {
      version?: number;
    } | null;
    expect(stored?.version).toBe(PREFERENCES_VERSION);
    expect(consoleError).not.toHaveBeenCalled();

    // 运行时偏好更新即时应用到 DOM 并持久化（SET-003-006 集成链；同一 hydration
    // 内验证——避免跨测试重复 rehydrate 的持久化闩锁）。
    useShellStore.getState().updateCategory('appearance', {
      themeMode: 'light',
      accent: 'blue',
    } as never);
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'));
    expect(document.documentElement).toHaveAttribute('data-accent', 'blue');
    const updated = JSON.parse(localStorage.getItem('clouddrive.shell') ?? 'null') as {
      state?: { preferences?: { appearance?: { themeMode?: string; accent?: string } } };
    } | null;
    expect(updated?.state?.preferences?.appearance?.themeMode).toBe('light');
    expect(updated?.state?.preferences?.appearance?.accent).toBe('blue');
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

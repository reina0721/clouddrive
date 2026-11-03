import { beforeEach, describe, expect, it } from 'vitest';
import { defaultPreferences } from '@clouddrive/surface/preferences-model';

import { useShellStore } from '../state/use-shell-store';

/**
 * Shell Store 行为测试（107 设置中心 v1）：
 * 直接驱动 actions（不依赖 hydration 单例时序），验证
 * - 分类更新写 preferences 并同步兼容投影；
 * - theme/locale/sidebar 快捷入口写入偏好显式值；
 * - remember 保留侧栏状态，不被无关偏好更新重置；
 * - 分类/全部恢复默认。
 */
describe('useShellStore（v1 嵌套偏好）', () => {
  beforeEach(() => {
    useShellStore.setState({
      preferences: defaultPreferences,
      theme: 'light',
      locale: 'zh-CN',
      hasHydrated: false,
      mobileNavigationOpen: false,
      sidebarCollapsed: false,
    });
  });

  it('初始状态 = 默认偏好 + 兼容投影', () => {
    const s = useShellStore.getState();
    expect(s.preferences).toEqual(defaultPreferences);
    expect(s.theme).toBe('light'); // system 默认 → light 投影（应用层再解析）
    expect(s.locale).toBe('zh-CN');
    expect(s.sidebarCollapsed).toBe(false);
  });

  it('updateCategory 写偏好并同步投影', () => {
    useShellStore.getState().updateCategory('appearance', { themeMode: 'dark', accent: 'blue' });
    const s = useShellStore.getState();
    expect(s.preferences.appearance.themeMode).toBe('dark');
    expect(s.preferences.appearance.accent).toBe('blue');
    expect(s.theme).toBe('dark');
  });

  it('setTheme/setLocale/setSidebarCollapsed 写入偏好显式值（兼容旧入口）', () => {
    const api = useShellStore.getState();
    api.setTheme('dark');
    api.setLocale('en');
    // 先设显式 expanded（离开默认 remember），再折叠 → 写 collapsed。
    api.updateCategory('navigation', { sidebarBehavior: 'expanded' });
    api.setSidebarCollapsed(true);
    const s = useShellStore.getState();
    expect(s.preferences.appearance.themeMode).toBe('dark');
    expect(s.preferences.localeRegion.language).toBe('en');
    expect(s.preferences.navigation.sidebarBehavior).toBe('collapsed');
    expect(s.theme).toBe('dark');
    expect(s.locale).toBe('en');
    expect(s.sidebarCollapsed).toBe(true);
  });

  it('sidebarBehavior=remember 保留策略，主题/语言/无关偏好更新不重置侧栏', () => {
    // 默认 sidebarBehavior = remember
    useShellStore.getState().setSidebarCollapsed(true);
    const s = useShellStore.getState();
    expect(s.preferences.navigation.sidebarBehavior).toBe('remember');
    expect(s.sidebarCollapsed).toBe(true);
    s.setTheme('dark');
    s.setLocale('en');
    s.updateCategory('dataDisplay', { pageSize: 50 });
    s.resetCategory('appearance');
    s.applyPersistedPreferences(useShellStore.getState().preferences);
    expect(useShellStore.getState().sidebarCollapsed).toBe(true);
    s.updateCategory('navigation', { sidebarBehavior: 'expanded' });
    expect(useShellStore.getState().sidebarCollapsed).toBe(false);
  });

  it('resetCategory 只恢复该分类默认', () => {
    useShellStore.getState().updateCategory('appearance', { themeMode: 'dark', accent: 'blue' });
    useShellStore.getState().updateCategory('dataDisplay', { pageSize: 50 });
    useShellStore.getState().resetCategory('appearance');
    const s = useShellStore.getState();
    expect(s.preferences.appearance).toEqual(defaultPreferences.appearance);
    expect(s.preferences.dataDisplay.pageSize).toBe(50); // 其它分类不受影响
  });

  it('resetAll 恢复全部默认并同步投影', () => {
    useShellStore.getState().updateCategory('appearance', { themeMode: 'dark' });
    useShellStore.getState().setLocale('en');
    useShellStore.getState().setSidebarCollapsed(true);
    useShellStore.getState().resetAll();
    const s = useShellStore.getState();
    expect(s.preferences).toEqual(defaultPreferences);
    expect(s.theme).toBe('light');
    expect(s.locale).toBe('zh-CN');
    expect(s.sidebarCollapsed).toBe(false);
  });
});

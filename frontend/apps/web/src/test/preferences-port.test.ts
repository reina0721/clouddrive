// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultPreferences, type Preferences } from '@clouddrive/surface/preferences-model';

import { createHostPreferencesPort } from '../host/preferences-port';
import { useShellStore } from '../state/use-shell-store';

const PERSIST_KEY = 'clouddrive.shell';

function storedPreferences(): Preferences {
  const raw = window.localStorage.getItem(PERSIST_KEY);
  if (!raw) throw new Error('no stored shell');
  const parsed = JSON.parse(raw) as { state?: { preferences?: Preferences } };
  const prefs = parsed.state?.preferences;
  if (!prefs) throw new Error('no preferences in stored shell');
  return prefs;
}

describe('Host Preferences Port', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useShellStore.setState({
      preferences: defaultPreferences,
      theme: 'light',
      locale: 'zh-CN',
      hasHydrated: false,
      hydrationIssue: null,
      mobileNavigationOpen: false,
      sidebarCollapsed: false,
    });
  });

  it('updateCategory 写 store 并持久化；resetAll 恢复默认（只写偏好）', () => {
    const port = createHostPreferencesPort();
    const result = port.updateCategory('appearance', { themeMode: 'dark', accent: 'blue' });
    expect(result.ok).toBe(true);
    expect(useShellStore.getState().preferences.appearance.themeMode).toBe('dark');
    expect(storedPreferences().appearance.themeMode).toBe('dark');
    const reset = port.resetAll();
    expect(reset.ok).toBe(true);
    expect(useShellStore.getState().preferences).toEqual(defaultPreferences);
  });

  it('subscribe 感知分类更新', () => {
    const port = createHostPreferencesPort();
    const listener = vi.fn();
    const unsubscribe = port.subscribe(listener);
    port.updateCategory('dataDisplay', { pageSize: 50 });
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('跨窗口 storage 事件：完整快照收敛，损坏快照忽略', () => {
    const port = createHostPreferencesPort();
    const stop = port.startCrossWindowSync();
    // 另一窗口写入完整快照（dark/blue）→ 本窗口应用。
    const other: Preferences = {
      ...defaultPreferences,
      appearance: { ...defaultPreferences.appearance, themeMode: 'dark', accent: 'blue' },
    };
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: PERSIST_KEY,
        newValue: JSON.stringify({ state: { preferences: other }, version: 1 }),
        storageArea: window.localStorage,
      }),
    );
    expect(useShellStore.getState().preferences.appearance.themeMode).toBe('dark');
    expect(useShellStore.getState().theme).toBe('dark'); // 投影同步
    // 损坏快照 → 忽略，保留当前会话。
    const before = useShellStore.getState().preferences;
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: PERSIST_KEY,
        newValue: JSON.stringify({ state: { preferences: { bad: true } }, version: 1 }),
        storageArea: window.localStorage,
      }),
    );
    expect(useShellStore.getState().preferences).toBe(before);
    stop();
  });
});

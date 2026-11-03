import { createPersistStore, createLocalStorage } from '@clouddrive/state-foundation';
import {
  defaultPreferences,
  migrateShellV0Preferences,
  PREFERENCES_VERSION,
  validatePreferences,
  type PreferenceCategory,
  type Preferences,
} from '@clouddrive/surface/preferences-model';

import type { SupportedLocale as AppLocale } from '../i18n/i18n';

/**
 * Shell Store（Host 拥有）—— 经 state-foundation 契约创建。
 *
 * 107 设置中心（version 0 → 1）：
 * - 持久化形状升级为八分类嵌套 `Preferences`（surface preferences-model 单一事实源）；
 * - version 0 旧记录（theme/locale/sidebarCollapsed 平铺）经 migrate 保真映射为嵌套
 *   显式值（不套新默认）；首次（无记录）用 `defaultPreferences`；
 * - 运行时保留“兼容投影” `theme`(light|dark) / `locale` / `sidebarCollapsed`，供既有
 *   Shell 消费者（providers/app-shell）与 hydration 门控使用；真正持久化的是
 *   `preferences`。Sidebar 专项仅在 remember 策略下追加 rememberedSidebarCollapsed
 *   durable 字段；显式策略仍只由 preferences 决定，theme/locale 投影不入白名单。
 *   themeMode=system 的解析
 *   （matchMedia prefers-color-scheme）在 Host providers 应用层完成。
 * - skipHydration + hasHydrated 门控语义保持（AppLoadingSurface 依赖）。
 *
 * 失败语义：损坏/非法持久化记录不静默覆盖——migrate 非法输入回退默认并由 lifecycle
 * 呈现恢复动作（SET-003-005 细化）。
 */
type ShellState = {
  /** 八分类偏好（持久化单一事实源）。 */
  preferences: Preferences;
  /** 兼容投影：resolved 主题（light|dark；system 在应用层解析后写回此处）。 */
  theme: 'light' | 'dark';
  locale: AppLocale;
  sidebarCollapsed: boolean;
  hasHydrated: boolean;
  /** hydration 失败（损坏 v1/未知版本/存储不可用）时给出原因码；成功为 null。 */
  hydrationIssue: { code: 'corrupt' | 'storage-unavailable'; reason: string } | null;
  mobileNavigationOpen: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLocale: (locale: AppLocale) => void;
  setMobileNavigationOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** 分类更新（写 preferences + 同步兼容投影）。 */
  updateCategory: (
    category: PreferenceCategory,
    patch: Partial<Preferences[PreferenceCategory]>,
  ) => void;
  /** 恢复单分类默认。 */
  resetCategory: (category: PreferenceCategory) => void;
  /** 恢复全部默认。 */
  resetAll: () => void;
  /** 应用跨窗口同步来的完整偏好快照（校验由调用方完成；同步兼容投影）。 */
  applyPersistedPreferences: (preferences: Preferences) => void;
};

/** 白名单：八分类偏好 + remember 时的上次侧栏状态；瞬时 UI 不入库。 */
type ShellPersisted = { preferences: Preferences; rememberedSidebarCollapsed?: boolean };

/** 由嵌套偏好同步兼容投影（theme/locale/sidebarCollapsed）。 */
function projectPreferences(preferences: Preferences, rememberedSidebarCollapsed = false) {
  const themeMode = preferences.appearance.themeMode;
  return {
    theme: themeMode === 'system' ? 'light' : themeMode,
    locale: preferences.localeRegion.language,
    sidebarCollapsed:
      preferences.navigation.sidebarBehavior === 'remember'
        ? rememberedSidebarCollapsed
        : preferences.navigation.sidebarBehavior === 'collapsed',
  };
}

/** 把（可能损坏/缺失的）持久化输入解析为 typed Preferences；失败返回 null（不静默覆盖）。 */
function parsePersistedPreferences(persisted: unknown): Preferences | null {
  const legacy = persisted as Record<string, unknown> | null | undefined;
  if (!legacy || typeof legacy !== 'object') return null;
  if (legacy.preferences !== undefined) {
    const result = validatePreferences(legacy.preferences);
    if (result.ok) return result.value;
    return null; // v1 损坏 → 不静默默认，交失败语义呈现
  }
  // v0 平铺 → 保真迁移（非法输入视为损坏 → null）。
  const patch = migrateShellV0Preferences(legacy);
  if (patch === null) return null;
  return {
    appearance: { ...defaultPreferences.appearance, ...patch.appearance },
    navigation: { ...defaultPreferences.navigation, ...patch.navigation },
    dataDisplay: { ...defaultPreferences.dataDisplay, ...patch.dataDisplay },
    actionPreferences: {
      ...defaultPreferences.actionPreferences,
      ...patch.actionPreferences,
    },
    localeRegion: { ...defaultPreferences.localeRegion, ...patch.localeRegion },
    notifications: { ...defaultPreferences.notifications, ...patch.notifications },
    accessibility: { ...defaultPreferences.accessibility, ...patch.accessibility },
    security: { ...defaultPreferences.security, ...patch.security },
    shortcuts: { ...defaultPreferences.shortcuts, ...patch.shortcuts },
  };
}

export const useShellStore = createPersistStore<ShellState, ShellPersisted>(
  (set) => ({
    preferences: defaultPreferences,
    ...projectPreferences(defaultPreferences),
    hasHydrated: false,
    hydrationIssue: null,
    mobileNavigationOpen: false,
    setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    // 顶栏主题快捷切换：写入偏好 themeMode 显式 light|dark（离开 system）并同步投影。
    setTheme: (theme) =>
      set((state) => {
        const preferences: Preferences = {
          ...state.preferences,
          appearance: { ...state.preferences.appearance, themeMode: theme },
        };
        return { preferences, ...projectPreferences(preferences, state.sidebarCollapsed) };
      }),
    setLocale: (locale) =>
      set((state) => {
        const preferences: Preferences = {
          ...state.preferences,
          localeRegion: { ...state.preferences.localeRegion, language: locale },
        };
        return { preferences, ...projectPreferences(preferences, state.sidebarCollapsed) };
      }),
    setMobileNavigationOpen: (mobileNavigationOpen) => set({ mobileNavigationOpen }),
    // remember 保留策略并通过 partialize 记录上次模式；显式策略则写偏好。
    setSidebarCollapsed: (collapsed) =>
      set((state) => {
        const behavior = state.preferences.navigation.sidebarBehavior;
        if (behavior === 'remember') {
          return { sidebarCollapsed: collapsed };
        }
        const preferences: Preferences = {
          ...state.preferences,
          navigation: {
            ...state.preferences.navigation,
            sidebarBehavior: collapsed ? 'collapsed' : 'expanded',
          },
        };
        return { preferences, ...projectPreferences(preferences, state.sidebarCollapsed) };
      }),
    updateCategory: (category, patch) =>
      set((state) => {
        const preferences: Preferences = {
          ...state.preferences,
          [category]: { ...state.preferences[category], ...patch },
        };
        return { preferences, ...projectPreferences(preferences, state.sidebarCollapsed) };
      }),
    resetCategory: (category) =>
      set((state) => {
        const preferences: Preferences = {
          ...state.preferences,
          [category]: defaultPreferences[category],
        };
        return { preferences, ...projectPreferences(preferences, state.sidebarCollapsed) };
      }),
    resetAll: () =>
      set(() => {
        const preferences = defaultPreferences;
        return { preferences, ...projectPreferences(preferences) };
      }),
    applyPersistedPreferences: (preferences) =>
      set((state) => ({ preferences, ...projectPreferences(preferences, state.sidebarCollapsed) })),
  }),
  {
    name: 'clouddrive.shell',
    // v1 = 八分类嵌套偏好（107 设置中心）。
    version: PREFERENCES_VERSION,
    skipHydration: true,
    storage: createLocalStorage(),
    partialize: ({ preferences, sidebarCollapsed }) => ({
      preferences,
      ...(preferences.navigation.sidebarBehavior === 'remember'
        ? { rememberedSidebarCollapsed: sidebarCollapsed }
        : {}),
    }),
    // 读取期解析：v0 保真迁移 / v1 校验；损坏（无法解析）→ 抛错走 hydration 失败语义，
    // 不静默覆盖（调用方呈现原因 + 恢复动作）。
    migrate: (persisted) => {
      const parsed = parsePersistedPreferences(persisted);
      if (parsed === null) {
        throw new Error(
          'clouddrive.shell 持久化记录损坏或版本未知：拒绝静默覆盖，请检查本地数据或恢复默认。',
        );
      }
      // 版本升级必须保留 remember 策略下的侧栏状态（否则 v1 记录的折叠状态丢失）。
      const remembered = (persisted as { rememberedSidebarCollapsed?: unknown } | null)
        ?.rememberedSidebarCollapsed;
      return {
        preferences: parsed,
        ...(typeof remembered === 'boolean' ? { rememberedSidebarCollapsed: remembered } : {}),
      };
    },
    // 合并后同步兼容投影（zustand 默认 merge 不跑 partialize 投影，需显式保持）。
    merge: (persistedState, currentState) => {
      const typed = persistedState as ShellPersisted | undefined;
      if (!typed || !typed.preferences) return currentState;
      const result = validatePreferences(typed.preferences);
      if (!result.ok) return currentState;
      return {
        ...currentState,
        preferences: result.value,
        ...projectPreferences(result.value, typed.rememberedSidebarCollapsed === true),
      };
    },
    // 保持迁移前语义：hydration 完成后标记 hasHydrated（供 RuntimeProviders 门控）。
    // 失败（损坏 v1/未知版本/存储不可用）也标记完成并把失败码写入 hydrationIssue，
    // 由呈现层显示原因与恢复动作（不静默覆盖损坏记录、不永久停留在 loading）。
    onRehydrateStorage: () => (_state, error) => {
      if (error) {
        // 损坏记录无法解析（无可用数据可救）：清除损坏键，避免 persist 随本次
        // setState 把默认值静默写回损坏记录上方（呈现层会显示原因 + 恢复动作，
        // 不静默覆盖、不宣称保存成功）。
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('clouddrive.shell');
        }
        useShellStore.setState({
          hasHydrated: true,
          hydrationIssue: { code: 'corrupt', reason: String((error as Error)?.message ?? error) },
        });
        return;
      }
      useShellStore.setState({ hasHydrated: true, hydrationIssue: null });
    },
  },
);

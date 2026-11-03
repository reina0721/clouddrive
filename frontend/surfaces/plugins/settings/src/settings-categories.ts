import type { NavigationIconId } from '@clouddrive/surface/shell';
import type { Preferences } from '@clouddrive/surface/preferences-model';
/** 侧边栏分组（显示与数据 / 偏好与反馈 / 安全与隐私 / 辅助与输入）。 */
export type SettingsNavGroup = 'display' | 'preferences' | 'security' | 'assistive';

interface SettingsCategoryMetaInner {
  shortId: string;
  targetRouteId: string;
  categoryKey: keyof Preferences;
  labelKey: string;
  /** 语义 Icon id（Surface icon vocabulary，SET-011）。 */
  iconId: NavigationIconId;
  group: SettingsNavGroup;
}

export type SettingsCategoryMeta = Readonly<SettingsCategoryMetaInner>;

export const SETTINGS_CATEGORIES: readonly SettingsCategoryMeta[] = [
  {
    shortId: 'appearance',
    targetRouteId: 'settings',
    categoryKey: 'appearance',
    labelKey: 'settings.categories.appearance',
    iconId: 'palette',
    group: 'display',
  },
  {
    shortId: 'navigation',
    targetRouteId: 'settings.navigation',
    categoryKey: 'navigation',
    labelKey: 'settings.categories.navigation',
    iconId: 'navigation',
    group: 'display',
  },
  {
    shortId: 'data-display',
    targetRouteId: 'settings.data-display',
    categoryKey: 'dataDisplay',
    labelKey: 'settings.categories.dataDisplay',
    iconId: 'data',
    group: 'display',
  },
  {
    shortId: 'actions',
    targetRouteId: 'settings.actions',
    categoryKey: 'actionPreferences',
    labelKey: 'settings.categories.actionPreferences',
    iconId: 'action',
    group: 'preferences',
  },
  {
    shortId: 'locale',
    targetRouteId: 'settings.locale',
    categoryKey: 'localeRegion',
    labelKey: 'settings.categories.localeRegion',
    iconId: 'globe',
    group: 'preferences',
  },
  {
    shortId: 'notifications',
    targetRouteId: 'settings.notifications',
    categoryKey: 'notifications',
    labelKey: 'settings.categories.notifications',
    iconId: 'feedback',
    group: 'preferences',
  },
  {
    shortId: 'accessibility',
    targetRouteId: 'settings.accessibility',
    categoryKey: 'accessibility',
    labelKey: 'settings.categories.accessibility',
    iconId: 'accessibility',
    group: 'assistive',
  },
  {
    shortId: 'security',
    targetRouteId: 'settings.security',
    categoryKey: 'security',
    labelKey: 'settings.categories.security',
    // 既有 icon vocabulary 无 `shield` 语义 id；安全与隐私沿用系统/设置语义。
    iconId: 'settings',
    group: 'security',
  },
  {
    shortId: 'shortcuts',
    targetRouteId: 'settings.shortcuts',
    categoryKey: 'shortcuts',
    labelKey: 'settings.categories.shortcuts',
    iconId: 'keyboard',
    group: 'assistive',
  },
] as const;

/** 默认分类（外观）：canonical 在根路由 /settings。 */
export const appearanceMeta: SettingsCategoryMeta = SETTINGS_CATEGORIES[0]!;

/** 分组顺序与 label key（i18n）。 */
export const SETTINGS_NAV_GROUPS: ReadonlyArray<{
  group: SettingsNavGroup;
  labelKey: string;
}> = [
  { group: 'display', labelKey: 'settings.navGroups.display' },
  { group: 'preferences', labelKey: 'settings.navGroups.preferences' },
  { group: 'security', labelKey: 'settings.navGroups.security' },
  { group: 'assistive', labelKey: 'settings.navGroups.assistive' },
];

import { describe, expect, it } from 'vitest';

import {
  defaultPreferences,
  formatDateOnly,
  migrateShellV0Preferences,
  PREFERENCE_CATEGORIES,
  timeToIntlOptions,
  validateCategory,
  validatePreferences,
} from './preferences-model';

describe('preferences-model 默认值（新用户无记录）', () => {
  it('九分类齐全且各分类非空默认', () => {
    expect(PREFERENCE_CATEGORIES).toHaveLength(9);
    const pref = defaultPreferences;
    expect(pref.appearance.themeMode).toBe('system');
    expect(pref.appearance.accent).toBe('purple');
    expect(pref.appearance.density).toBe('standard');
    expect(pref.navigation.pageTabsEnabled).toBe(false);
    expect(pref.navigation.sidebarBehavior).toBe('remember');
    expect(pref.dataDisplay.pageSize).toBe(20);
    expect(pref.dataDisplay.rememberSort).toBe(false);
    expect(pref.actionPreferences.editSuccessDestination).toBe('stay');
    expect(pref.actionPreferences.createSuccessDestination).toBe('list');
    expect(pref.localeRegion.language).toBe('zh-CN');
    expect(pref.localeRegion.weekStart).toBe('monday');
    expect(pref.notifications.desktopNotifications).toBe(false);
    expect(pref.notifications.toastDuration).toBe('standard');
    expect(pref.shortcuts.enabled).toBe(true);
  });
});

describe('preferences-model migrateShellV0Preferences（旧用户保真）', () => {
  it('v0 三字段保真映射为 v1 显式值（不套新默认）', () => {
    const patch = migrateShellV0Preferences({
      theme: 'dark',
      locale: 'en',
      sidebarCollapsed: true,
    });
    expect(patch).not.toBeNull();
    expect(patch?.appearance?.themeMode).toBe('dark'); // 不套 system
    expect(patch?.localeRegion?.language).toBe('en');
    expect(patch?.navigation?.sidebarBehavior).toBe('collapsed'); // 不套 remember
  });

  it('sidebarCollapsed=false → expanded', () => {
    const patch = migrateShellV0Preferences({ sidebarCollapsed: false });
    expect(patch?.navigation?.sidebarBehavior).toBe('expanded');
  });

  it('展开态默认（无旧值）保持新默认 remember', () => {
    const patch = migrateShellV0Preferences({});
    expect(patch?.navigation).toBeUndefined();
    expect(defaultPreferences.navigation.sidebarBehavior).toBe('remember');
  });

  it('输入非法（null/数组/非对象）返回 null（不静默覆盖）', () => {
    expect(migrateShellV0Preferences(null)).toBeNull();
    expect(migrateShellV0Preferences('nope')).toBeNull();
    expect(migrateShellV0Preferences([1, 2])).toBeNull();
  });

  it('值域外 theme/locale 忽略该字段（不产生 patch）', () => {
    const patch = migrateShellV0Preferences({ theme: 'neon', locale: 'fr' });
    expect(patch?.appearance).toBeUndefined();
    expect(patch?.localeRegion).toBeUndefined();
  });
});

describe('preferences-model validatePreferences（不可信持久化守卫）', () => {
  it('旧记录补全固定标签默认值，显式关闭保真，非法字段拒绝', () => {
    const legacy = validatePreferences({ navigation: { pageTabsEnabled: true } });
    expect(legacy.ok && legacy.value.navigation.pageTabsPinned).toBe(true);
    const explicit = validatePreferences({ navigation: { pageTabsPinned: false } });
    expect(explicit.ok && explicit.value.navigation.pageTabsPinned).toBe(false);
    expect(validatePreferences({ navigation: { pageTabsPinned: 'yes' } }).ok).toBe(false);
  });
  it('完整合法输入通过并保真', () => {
    const input = {
      appearance: { themeMode: 'dark', accent: 'blue' },
      dataDisplay: { pageSize: 50 },
      localeRegion: { language: 'en', weekStart: 'sunday' },
    };
    const result = validatePreferences(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const value = result.value;
      expect(value.appearance.themeMode).toBe('dark');
      expect(value.appearance.accent).toBe('blue');
      expect(value.dataDisplay.pageSize).toBe(50);
      expect(value.localeRegion.language).toBe('en');
      expect(value.localeRegion.weekStart).toBe('sunday');
    }
  });

  it('缺失分类用默认值补全', () => {
    const result = validatePreferences({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(defaultPreferences);
    }
  });

  it('非法联合值 → 失败并报告路径', () => {
    const result = validatePreferences({
      appearance: { themeMode: 'neon' },
      notifications: { toastDuration: 'forever' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.issues.map((i) => i.path);
      expect(paths).toContain('appearance.themeMode');
      expect(paths).toContain('notifications.toastDuration');
    }
  });

  it('pageSize 非法值拒绝', () => {
    const result = validatePreferences({ dataDisplay: { pageSize: 30 } });
    expect(result.ok).toBe(false);
  });

  it('pageTransition：旧记录补 default，显式值保真，非法值拒绝', () => {
    const legacy = validatePreferences({ appearance: { themeMode: 'dark' } });
    expect(legacy.ok && legacy.value.appearance.pageTransition).toBe('default');

    const explicit = validatePreferences({ appearance: { pageTransition: 'fade-slide' } });
    expect(explicit.ok && explicit.value.appearance.pageTransition).toBe('fade-slide');

    const invalid = validatePreferences({ appearance: { pageTransition: 'zoom' } });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.issues.map((issue) => issue.path)).toContain('appearance.pageTransition');
    }
  });

  it('numbersFollowLocale 不可关闭', () => {
    const result = validatePreferences({ localeRegion: { numbersFollowLocale: false } });
    expect(result.ok).toBe(false);
  });

  it('非对象输入整体失败', () => {
    expect(validatePreferences(null).ok).toBe(false);
    expect(validatePreferences('x').ok).toBe(false);
  });
});

describe('preferences-model validateCategory 单分类', () => {
  it('navigation 布尔字段非法值拒绝', () => {
    const result = validateCategory('navigation', { pageTabsEnabled: 'yes' });
    expect(result.ok).toBe(false);
  });

  it('actionPreferences 受限去向拒绝', () => {
    const result = validateCategory('actionPreferences', {
      editSuccessDestination: 'somewhere',
    });
    expect(result.ok).toBe(false);
  });
});

describe('preferences-model 地区格式（语言与地区 → 展示，SET-006-003）', () => {
  it('formatDateOnly：YYYY-MM-DD / MM/DD/YYYY / DD/MM/YYYY 排版且不因时区偏移', () => {
    // UTC 中午（避免任何本地时区把日期推走）→ 三种格式各按其顺序。
    const utcNoon = Date.UTC(2026, 2, 5, 12, 0, 0); // 2026-03-05
    expect(formatDateOnly('YYYY-MM-DD', utcNoon)).toBe('2026-03-05');
    expect(formatDateOnly('MM/DD/YYYY', utcNoon)).toBe('03/05/2026');
    expect(formatDateOnly('DD/MM/YYYY', utcNoon)).toBe('05/03/2026');
  });

  it('timeToIntlOptions：24 小时无秒 / 12 小时有秒', () => {
    expect(timeToIntlOptions({ hourCycle: 'h24', showSeconds: false })).toEqual({
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    expect(timeToIntlOptions({ hourCycle: 'h12', showSeconds: true })).toEqual({
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  });
});

import { describe, expect, it } from 'vitest';

import { normalizeSearchTerm, searchSettings, SETTINGS_INDEX } from './settings-index';
import { pluginI18nResources } from '../i18n';

/** 简易 i18n resolve：key → zh 文案（仅覆盖测试涉及键；用直出词表保证可读）。 */
function zhResolver(key: string): string {
  const table: Record<string, string> = {
    'settings.categories.appearance': '外观',
    'settings.categories.navigation': '导航',
    'settings.categories.dataDisplay': '数据展示',
    'settings.categories.actionPreferences': '操作偏好',
    'settings.categories.localeRegion': '语言与地区',
    'settings.categories.notifications': '通知',
    'settings.categories.accessibility': '可访问性',
    'settings.categories.shortcuts': '快捷键',
    'settings.appearance.motion': '动效偏好',
    'settings.appearance.motionDescription': '跟随系统、标准或减少动效。',
    'settings.appearance.themeMode': '主题模式',
    'settings.appearance.accent': '强调色',
    'settings.navigation.menuMemory': '记住展开的侧栏菜单',
    'settings.shortcuts.enabled': '启用快捷键',
    'settings.actionPreferences.confirmDelete': '删除前二次确认',
  };
  return table[key] ?? key;
}

describe('settings-index 搜索目录', () => {
  it('“动画”命中外观·动效与页面切换（同义词）', () => {
    const { categories } = searchSettings('动画', zhResolver);
    expect(categories).toContain('appearance');
    const { entries } = searchSettings('动效', zhResolver);
    expect(entries.some((e) => e.fieldId === 'motion')).toBe(true);
    const transitions = searchSettings('页面切换', zhResolver);
    expect(transitions.entries.some((e) => e.fieldId === 'pageTransition')).toBe(true);
  });

  it('“快捷键”命中 shortcuts.enabled', () => {
    const { entries } = searchSettings('快捷键', zhResolver);
    expect(entries.some((e) => e.fieldId === 'enabled')).toBe(true);
  });

  it('“删除”命中操作偏好 confirmDelete', () => {
    const { entries } = searchSettings('删除', zhResolver);
    expect(entries.some((e) => e.fieldId === 'confirmDelete')).toBe(true);
  });

  it('空查询返回空（页面恢复全部分类）', () => {
    const result = searchSettings('   ', zhResolver);
    expect(result.entries).toHaveLength(0);
  });

  it('无命中返回空', () => {
    const result = searchSettings('zzz-no-such-term-zzz', zhResolver);
    expect(result.entries).toHaveLength(0);
  });

  it('normalizeSearchTerm 小写化', () => {
    expect(normalizeSearchTerm('  Animation ')).toBe('animation');
  });

  it('目录覆盖九分类且每条含 category/fieldId', () => {
    const expectedCategories = [
      'appearance',
      'navigation',
      'dataDisplay',
      'actionPreferences',
      'localeRegion',
      'notifications',
      'accessibility',
      'security',
      'shortcuts',
    ];
    const categories = new Set(SETTINGS_INDEX.map((e) => e.category));
    expect(categories.size).toBe(expectedCategories.length);
    expect([...categories].sort()).toEqual([...expectedCategories].sort());
    for (const entry of SETTINGS_INDEX) {
      expect(entry.category.length).toBeGreaterThan(0);
      expect(entry.fieldId.length).toBeGreaterThan(0);
    }
  });

  it('新增安全/外观/导航字段在目录中且中英文名称与说明都有真实文案', () => {
    const newFieldIds = [
      ['security', 'watermark'],
      ['security', 'watermarkText'],
      ['security', 'idleLockMinutes'],
      ['security', 'lockOnHidden'],
      ['appearance', 'colorWeak'],
      ['appearance', 'grayscale'],
      ['appearance', 'pageTransition'],
      ['navigation', 'layoutMode'],
    ] as const;

    const resolve = (locale: 'zh-CN' | 'en', key: string): unknown =>
      key.split('.').reduce<unknown>((value, part) => {
        if (value !== null && typeof value === 'object' && part in value) {
          return Reflect.get(value, part);
        }
        return undefined;
      }, pluginI18nResources[locale].translation);

    for (const [category, fieldId] of newFieldIds) {
      const entry = SETTINGS_INDEX.find(
        (candidate) => candidate.category === category && candidate.fieldId === fieldId,
      );
      expect(entry, `${category}.${fieldId}`).toBeDefined();
      if (!entry) continue;
      for (const locale of ['zh-CN', 'en'] as const) {
        const name = resolve(locale, entry.nameKey);
        expect(name, `${locale}: ${entry.nameKey}`).toBeTypeOf('string');
        expect(name).not.toBe(entry.nameKey);
        if (entry.descriptionKey) {
          const description = resolve(locale, entry.descriptionKey);
          expect(description, `${locale}: ${entry.descriptionKey}`).toBeTypeOf('string');
          expect(description).not.toBe(entry.descriptionKey);
        }
      }
    }
  });

  it('所有搜索入口使用唯一字段标识，名称在中英文都可解析', () => {
    const identities = SETTINGS_INDEX.map((entry) => `${entry.category}.${entry.fieldId}`);
    expect(new Set(identities).size).toBe(identities.length);
    for (const locale of ['zh-CN', 'en'] as const) {
      for (const entry of SETTINGS_INDEX) {
        const resolve = (key: string): unknown =>
          key.split('.').reduce<unknown>((value, part) => {
            if (value !== null && typeof value === 'object' && part in value) {
              return Reflect.get(value, part);
            }
            return undefined;
          }, pluginI18nResources[locale].translation);
        expect(resolve(entry.nameKey), `${locale}: ${entry.nameKey}`).toBeTypeOf('string');
        if (entry.descriptionKey) {
          expect(resolve(entry.descriptionKey), `${locale}: ${entry.descriptionKey}`).toBeTypeOf(
            'string',
          );
        }
      }
    }
  });

  it('新增安全分类的分类标签、导航分组与导语文案中英文齐备', () => {
    const resolve = (locale: 'zh-CN' | 'en', key: string): unknown =>
      key.split('.').reduce<unknown>((value, part) => {
        if (value !== null && typeof value === 'object' && part in value) {
          return Reflect.get(value, part);
        }
        return undefined;
      }, pluginI18nResources[locale].translation);
    const keys = [
      'settings.categories.security',
      'settings.navGroups.security',
      'settings.categoryIntro.security',
      'settings.groups.watermark',
      'settings.groups.lock',
      'settings.transfer.title',
    ];
    for (const locale of ['zh-CN', 'en'] as const) {
      for (const key of keys) {
        const value = resolve(locale, key);
        expect(value, `${locale}: ${key}`).toBeTypeOf('string');
        expect(value).not.toBe(key);
      }
    }
  });

  it('新增目的地、时区和提示时长均能通过同义词发现', () => {
    expect(searchSettings('保存去向', zhResolver).entries.map((entry) => entry.fieldId)).toContain(
      'editSuccessDestination',
    );
    expect(searchSettings('timezone', zhResolver).entries.map((entry) => entry.fieldId)).toContain(
      'timeZone',
    );
    expect(searchSettings('提示时长', zhResolver).entries.map((entry) => entry.fieldId)).toContain(
      'toastDuration',
    );
  });
});

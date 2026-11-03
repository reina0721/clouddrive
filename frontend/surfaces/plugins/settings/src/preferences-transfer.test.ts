import { describe, expect, it } from 'vitest';

import {
  defaultAppearance,
  defaultNavigation,
  defaultPreferences,
  PREFERENCE_CATEGORIES,
  PREFERENCES_VERSION,
  type Preferences,
} from '@clouddrive/surface/preferences-model';

import {
  changedPreferenceCategories,
  IMPORT_ISSUE_CODE_PREFIX,
  IMPORT_ISSUE_FIELD_PREFIX,
  importedPreferencesFieldPath,
  importedPreferencesIssueCode,
  parseImportedPreferences,
  PREFERENCES_EXPORT_KIND,
  serializePreferences,
} from './preferences-transfer';

const fixedNow = new Date('2026-01-02T03:04:05.000Z');

const customizedPreferences: Preferences = {
  ...defaultPreferences,
  appearance: { ...defaultAppearance, colorWeak: true, grayscale: true, themeMode: 'dark' },
  navigation: { ...defaultNavigation, layoutMode: 'mixed' },
  security: {
    watermark: true,
    watermarkText: '仅限内部使用',
    idleLockMinutes: 15,
    lockOnHidden: true,
  },
};

describe('preferences-transfer 配置信封', () => {
  it('序列化为稳定信封：kind/version/exportedAt + 按模型顺序的 preferences', () => {
    const text = serializePreferences(defaultPreferences, fixedNow);
    const raw: unknown = JSON.parse(text);
    expect(raw).toBeTypeOf('object');
    const envelope = raw as Record<string, unknown>;
    expect(envelope.kind).toBe(PREFERENCES_EXPORT_KIND);
    expect(envelope.version).toBe(PREFERENCES_VERSION);
    expect(envelope.exportedAt).toBe('2026-01-02T03:04:05.000Z');
    const preferences = envelope.preferences as Record<string, unknown>;
    expect(Object.keys(preferences)).toEqual([...PREFERENCE_CATEGORIES]);
  });

  it('相同输入 + 相同时间得到完全一致的文本（可复制/可比对）', () => {
    expect(serializePreferences(customizedPreferences, fixedNow)).toBe(
      serializePreferences(customizedPreferences, fixedNow),
    );
  });

  it('导出→导入 round-trip 不丢字段', () => {
    const parsed = parseImportedPreferences(serializePreferences(customizedPreferences, fixedNow));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual(customizedPreferences);
    expect(parsed.value.security.idleLockMinutes).toBe(15);
    expect(parsed.value.navigation.layoutMode).toBe('mixed');
    expect(parsed.value.appearance.colorWeak).toBe(true);
  });

  it('导入后相对当前偏好只列出真正变化的分类', () => {
    const parsed = parseImportedPreferences(serializePreferences(customizedPreferences, fixedNow));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const changed = changedPreferenceCategories(defaultPreferences, parsed.value);
    expect(changed).toEqual(['appearance', 'navigation', 'security']);
    expect(changedPreferenceCategories(parsed.value, parsed.value)).toEqual([]);
  });
});

describe('preferences-transfer 导入拒绝路径', () => {
  const reject = (text: string, issue: string) => {
    const parsed = parseImportedPreferences(text);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues).toContain(issue);
    expect(parsed).not.toHaveProperty('value');
  };

  it('空文本', () => {
    reject('   ', `${IMPORT_ISSUE_CODE_PREFIX}empty`);
  });

  it('非法 JSON', () => {
    reject('{ not json', `${IMPORT_ISSUE_CODE_PREFIX}invalid-json`);
  });

  it('顶层不是对象', () => {
    reject('[]', `${IMPORT_ISSUE_CODE_PREFIX}not-object`);
  });

  it('kind 不是本产品导出格式', () => {
    reject(
      JSON.stringify({ kind: 'other.product', version: 1, preferences: defaultPreferences }),
      `${IMPORT_ISSUE_CODE_PREFIX}wrong-kind`,
    );
  });

  it('未来版本明确拒绝（不做降级猜测）', () => {
    reject(
      JSON.stringify({
        kind: PREFERENCES_EXPORT_KIND,
        version: PREFERENCES_VERSION + 1,
        preferences: defaultPreferences,
      }),
      `${IMPORT_ISSUE_CODE_PREFIX}future-version`,
    );
  });

  it('版本号非法', () => {
    reject(
      JSON.stringify({
        kind: PREFERENCES_EXPORT_KIND,
        version: 0,
        preferences: defaultPreferences,
      }),
      `${IMPORT_ISSUE_CODE_PREFIX}unsupported-version`,
    );
  });

  it('缺少 preferences 字段', () => {
    reject(
      JSON.stringify({ kind: PREFERENCES_EXPORT_KIND, version: PREFERENCES_VERSION }),
      `${IMPORT_ISSUE_CODE_PREFIX}missing-preferences`,
    );
  });

  it('任一分类非法则整体失败，不返回部分配置', () => {
    const parsed = parseImportedPreferences(
      JSON.stringify({
        kind: PREFERENCES_EXPORT_KIND,
        version: PREFERENCES_VERSION,
        preferences: {
          appearance: { ...defaultAppearance, themeMode: 'dark' },
          security: { idleLockMinutes: 3 },
        },
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues).toContain(`${IMPORT_ISSUE_FIELD_PREFIX}security.idleLockMinutes`);
    expect(parsed).not.toHaveProperty('value');
  });

  it('issue token 可还原为字段路径 / code', () => {
    expect(importedPreferencesFieldPath(`${IMPORT_ISSUE_FIELD_PREFIX}security.watermark`)).toBe(
      'security.watermark',
    );
    expect(importedPreferencesFieldPath(`${IMPORT_ISSUE_CODE_PREFIX}empty`)).toBeNull();
    expect(importedPreferencesIssueCode(`${IMPORT_ISSUE_CODE_PREFIX}wrong-kind`)).toBe(
      'wrong-kind',
    );
    expect(importedPreferencesIssueCode(`${IMPORT_ISSUE_CODE_PREFIX}nope`)).toBeNull();
    expect(
      importedPreferencesIssueCode(`${IMPORT_ISSUE_FIELD_PREFIX}security.watermark`),
    ).toBeNull();
  });
});

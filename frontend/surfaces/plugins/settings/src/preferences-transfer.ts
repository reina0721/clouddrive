/**
 * settings —— 偏好配置导出/导入（纯模型；无 React、无浏览器 API、无存储读写）。
 *
 * 目标：把「配置输出」变成可携带、可校验的单一格式。
 * - `serializePreferences`：稳定 JSON 信封（kind/version/exportedAt/preferences），
 *   分类按模型 key 顺序输出，字段顺序与 `Preferences` 定义一致；
 * - `parseImportedPreferences`：拒绝错误 kind、未来版本与非法字段；整份配置要么
 *   全部通过 `validatePreferences`，要么整体失败（绝不部分应用）；
 * - issue 采用稳定 token（`code:*` / `field:*`），由设置页用 i18n 呈现，
 *   纯模型不携带任何用户可见文案。
 */

import {
  PREFERENCE_CATEGORIES,
  PREFERENCES_VERSION,
  validatePreferences,
  type PreferenceCategory,
  type Preferences,
} from '@clouddrive/surface/preferences-model';

/** 导出信封标识（与持久化 namespace 一致；导入时严格匹配）。 */
export const PREFERENCES_EXPORT_KIND = 'clouddrive.preferences';

/** issue token 前缀：版本/结构级问题。 */
export const IMPORT_ISSUE_CODE_PREFIX = 'code:';
/** issue token 前缀：字段级校验失败（后接模型字段路径）。 */
export const IMPORT_ISSUE_FIELD_PREFIX = 'field:';

/** 版本/结构级 issue code（设置页按 code 取 i18n 文案）。 */
export const IMPORT_ISSUE_CODES = [
  'empty',
  'invalid-json',
  'not-object',
  'wrong-kind',
  'unsupported-version',
  'future-version',
  'missing-preferences',
] as const;
export type ImportIssueCode = (typeof IMPORT_ISSUE_CODES)[number];

/** 导出的配置信封（`exportedAt` 仅作来源信息，导入不依赖它）。 */
export type PreferencesExportEnvelope = Readonly<{
  kind: typeof PREFERENCES_EXPORT_KIND;
  version: number;
  exportedAt: string;
  preferences: Preferences;
}>;

export type PreferencesImportResult =
  Readonly<{ ok: true; value: Preferences }> | Readonly<{ ok: false; issues: string[] }>;

const codeIssue = (code: ImportIssueCode): string => `${IMPORT_ISSUE_CODE_PREFIX}${code}`;

/** 字段级 issue 的模型字段路径（`category.field`）；非字段级 issue 返回 null。 */
export function importedPreferencesFieldPath(issue: string): string | null {
  return issue.startsWith(IMPORT_ISSUE_FIELD_PREFIX)
    ? issue.slice(IMPORT_ISSUE_FIELD_PREFIX.length)
    : null;
}

/** 版本/结构级 issue code；非 code issue 返回 null。 */
export function importedPreferencesIssueCode(issue: string): ImportIssueCode | null {
  if (!issue.startsWith(IMPORT_ISSUE_CODE_PREFIX)) return null;
  const code = issue.slice(IMPORT_ISSUE_CODE_PREFIX.length);
  return (IMPORT_ISSUE_CODES as readonly string[]).includes(code)
    ? (code as ImportIssueCode)
    : null;
}

/**
 * 稳定序列化当前偏好：分类顺序 = `PREFERENCE_CATEGORIES`，每类字段顺序 = 模型定义。
 * `now` 仅用于测试注入确定时间。
 */
export function serializePreferences(prefs: Preferences, now: Date = new Date()): string {
  const envelope: PreferencesExportEnvelope = {
    kind: PREFERENCES_EXPORT_KIND,
    version: PREFERENCES_VERSION,
    exportedAt: now.toISOString(),
    preferences: {
      appearance: prefs.appearance,
      navigation: prefs.navigation,
      dataDisplay: prefs.dataDisplay,
      actionPreferences: prefs.actionPreferences,
      localeRegion: prefs.localeRegion,
      notifications: prefs.notifications,
      accessibility: prefs.accessibility,
      security: prefs.security,
      shortcuts: prefs.shortcuts,
    },
  };
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

/**
 * 解析并校验导入文本。
 *
 * 规则：
 * - 空文本/非法 JSON/非对象 → 结构级失败；
 * - `kind` 不等于 `PREFERENCES_EXPORT_KIND` → 拒绝（不猜测其它产品的配置）；
 * - `version` 必须是 1..PREFERENCES_VERSION 的整数；更高版本明确拒绝，不做降级猜测；
 * - `preferences` 经 `validatePreferences` 全量校验：任一分类非法则整体失败，
 *   绝不返回「部分可用」的配置。
 */
export function parseImportedPreferences(text: string): PreferencesImportResult {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, issues: [codeIssue('empty')] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, issues: [codeIssue('invalid-json')] };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, issues: [codeIssue('not-object')] };
  }
  const envelope = parsed as Record<string, unknown>;

  if (envelope.kind !== PREFERENCES_EXPORT_KIND) {
    return { ok: false, issues: [codeIssue('wrong-kind')] };
  }

  const version = envelope.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, issues: [codeIssue('unsupported-version')] };
  }
  if (version > PREFERENCES_VERSION) {
    return { ok: false, issues: [codeIssue('future-version')] };
  }

  if (!('preferences' in envelope) || envelope.preferences === undefined) {
    return { ok: false, issues: [codeIssue('missing-preferences')] };
  }

  const validated = validatePreferences(envelope.preferences);
  if (!validated.ok) {
    const issues = [
      ...new Set(validated.issues.map((issue) => `${IMPORT_ISSUE_FIELD_PREFIX}${issue.path}`)),
    ];
    return { ok: false, issues };
  }

  return { ok: true, value: validated.value };
}

function valuesEqual(
  left: Preferences[PreferenceCategory],
  right: Preferences[PreferenceCategory],
): boolean {
  const leftRecord = left as Readonly<Record<string, unknown>>;
  const rightRecord = right as Readonly<Record<string, unknown>>;
  const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
  for (const key of keys) {
    if (leftRecord[key] !== rightRecord[key]) return false;
  }
  return true;
}

/**
 * 与当前偏好相比真正变化的分类（导入只写这些分类，未变化的分类不产生写入）。
 */
export function changedPreferenceCategories(
  current: Preferences,
  next: Preferences,
): readonly PreferenceCategory[] {
  return PREFERENCE_CATEGORIES.filter(
    (category) => !valuesEqual(current[category], next[category]),
  );
}

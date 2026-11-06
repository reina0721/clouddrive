export const zhRetention = {
  title: '版本保留设置',
  description: '为你的账号设置未来内容覆盖的历史规则，保存后跨设备生效。',
  enabled: '启用版本保留',
  enabledHint: '符合扩展名条件的文件在覆盖时保留旧内容。关闭不会清理已有历史。',
  extensions: '启用的文件扩展名',
  extensionsHint: '用空格或逗号分隔，例如 txt, md。留空适用于全部；最多32项，不可重复。',
  max: '最多保留旧版本数',
  maxHint: '0表示不额外限制数量；仍受服务器每文件最多20条、账号总量及空间预算限制。',
  warning:
    '设置保存不会立即清理已有历史。设置数量上限后，后续成功覆盖会移除超出数量的最早历史关联；当前内容保留。此操作不保证立即释放物理磁盘空间。',
  invalid: '请检查扩展名及数量。扩展名仅支持字母、数字和内部连字符或下划线；数量须为0–20整数。',
  conflict: '设置已被另一处修改。当前草稿已保留，请明确读取最新设置后再编辑保存。',
  latest: '读取最新设置',
  retry: '重新读取',
  save: '保存版本规则',
  loading: '正在读取版本规则…',
  applies: '此文件未来覆盖会保留历史。',
  excluded: '此文件未来覆盖不新增历史；已有历史仍可查看和恢复。',
  count: '账号最多保留最近{{count}}个旧版本，成功覆盖时执行。',
  unlimited: '账号未设置额外数量限制，服务器预算仍适用。',
};
export const enRetention: typeof zhRetention = {
  title: 'Version retention settings',
  description:
    'Set account rules for future content replacements. Saved rules apply across devices.',
  enabled: 'Keep file versions',
  enabledHint:
    'Keep old content when a matching file is replaced. Turning this off leaves existing history intact.',
  extensions: 'Enabled file extensions',
  extensionsHint:
    'Separate with spaces or commas, e.g. txt, md. Empty matches all files; up to 32 unique extensions.',
  max: 'Maximum old versions',
  maxHint:
    '0 adds no account limit. Server limits still apply: up to 20 old versions per file, account totals and storage quota.',
  warning:
    'Saving settings does not immediately clear history. With a count limit, future successful replacements remove the oldest excess history links while keeping current content. Physical disk space may not be released immediately.',
  invalid:
    'Check extensions and count. Use letters, digits, and internal hyphens or underscores; count must be an integer from 0 to 20.',
  conflict:
    'Settings changed elsewhere. Your draft is preserved. Explicitly load the latest settings before editing and saving again.',
  latest: 'Load latest settings',
  retry: 'Retry loading',
  save: 'Save version rules',
  loading: 'Loading version rules…',
  applies: 'Future replacements of this file keep history.',
  excluded:
    'Future replacements of this file add no history. Existing versions remain readable and restorable.',
  count: 'Keep the latest {{count}} old versions on successful replacement.',
  unlimited: 'No additional account count limit. Server budgets still apply.',
};

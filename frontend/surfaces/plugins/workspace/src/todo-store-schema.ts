/**
 * 待办 store 的存储边界校验（untrusted JSON → 明确结果）。
 *
 * - 结构不合法（非对象 / completedIds 非字符串数组）→ `{ ok: false }`，调用方回退默认值
 *   并给出非阻塞 warning；
 * - 合法结构里出现已退役/未知 id → 丢弃该 id 并记录 `unknownIds`，不做静默保留。
 */
export type TodoPersistedParseResult =
  | Readonly<{ ok: true; completedIds: readonly string[]; unknownIds: readonly string[] }>
  | Readonly<{ ok: false }>;

export function parseTodoPersisted(
  value: unknown,
  knownIds: readonly string[],
): TodoPersistedParseResult {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('completedIds' in value)) {
    return { ok: false };
  }
  const raw = value.completedIds;
  if (!Array.isArray(raw)) return { ok: false };

  const known = new Set(knownIds);
  const completedIds: string[] = [];
  const unknownIds: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') return { ok: false };
    if (!known.has(entry)) {
      unknownIds.push(entry);
      continue;
    }
    if (!completedIds.includes(entry)) completedIds.push(entry);
  }
  return { ok: true, completedIds, unknownIds };
}

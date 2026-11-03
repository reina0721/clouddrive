import type { UsersColumnLayoutPersisted } from '../stores/column-layout';

const invalid = (): never => {
  throw new Error('users column-layout: 记录损坏');
};

/**
 * 校验持久化记录（不可信 storage 边界）：只接受 `layouts[userId].visibleOrder` 的字符串数组。
 * 未知字段忽略，类型不符直接抛错交由 hydration lifecycle 呈现。
 */
export function parseUsersColumnLayoutPersisted(value: unknown): UsersColumnLayoutPersisted {
  if (
    !value ||
    typeof value !== 'object' ||
    !('layouts' in value) ||
    !value.layouts ||
    typeof value.layouts !== 'object' ||
    Array.isArray(value.layouts)
  )
    return invalid();
  const layouts: Record<string, { visibleOrder: readonly string[] }> = {};
  for (const [userId, entry] of Object.entries(value.layouts)) {
    const row: unknown = entry;
    if (
      !row ||
      typeof row !== 'object' ||
      !('visibleOrder' in row) ||
      !Array.isArray(row.visibleOrder)
    )
      return invalid();
    const visibleOrder: string[] = [];
    for (const id of row.visibleOrder) {
      if (typeof id !== 'string') return invalid();
      if (!visibleOrder.includes(id)) visibleOrder.push(id);
    }
    layouts[userId] = { visibleOrder };
  }
  return { layouts };
}

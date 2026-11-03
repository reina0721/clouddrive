import type { AuditColumnLayoutPersisted } from '../stores/column-layout';

const invalid = (): never => {
  throw new Error('audit column-layout: 记录损坏');
};

/** 校验持久化记录（不可信 storage 边界）：`visibleOrder` 只接受字符串数组或 null。 */
export function parseAuditColumnLayoutPersisted(value: unknown): AuditColumnLayoutPersisted {
  if (!value || typeof value !== 'object' || !('visibleOrder' in value)) return invalid();
  const raw = value.visibleOrder;
  if (raw === null) return { visibleOrder: null };
  if (!Array.isArray(raw)) return invalid();
  const visibleOrder: string[] = [];
  for (const id of raw) {
    if (typeof id !== 'string') return invalid();
    if (!visibleOrder.includes(id)) visibleOrder.push(id);
  }
  return { visibleOrder };
}

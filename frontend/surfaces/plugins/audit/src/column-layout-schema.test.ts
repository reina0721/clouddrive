import { describe, expect, it } from 'vitest';

import { normalizeColumnLayout } from '@clouddrive/core';
import { parseAuditColumnLayoutPersisted } from './column-layout-schema';

describe('audit column-layout 持久化校验', () => {
  it('接受字符串数组或 null（未保存）', () => {
    expect(parseAuditColumnLayoutPersisted({ visibleOrder: null })).toEqual({ visibleOrder: null });
    expect(
      parseAuditColumnLayoutPersisted({ visibleOrder: ['time', 'time', 'operation'] }),
    ).toEqual({ visibleOrder: ['time', 'operation'] });
  });

  it('损坏记录抛错（不静默接受）', () => {
    expect(() => parseAuditColumnLayoutPersisted(null)).toThrow();
    expect(() => parseAuditColumnLayoutPersisted({})).toThrow();
    expect(() => parseAuditColumnLayoutPersisted({ visibleOrder: 'time' })).toThrow();
    expect(() => parseAuditColumnLayoutPersisted({ visibleOrder: [1] })).toThrow();
  });

  it('恢复值与 normalizeColumnLayout 组合后必选列置首', () => {
    const parsed = parseAuditColumnLayoutPersisted({
      visibleOrder: ['result', 'operation', 'retired'],
    });
    expect(
      normalizeColumnLayout(
        ['time', 'operation', 'actor', 'object', 'result'],
        parsed.visibleOrder ?? undefined,
        new Set(['operation']),
      ),
    ).toEqual(['operation', 'result']);
  });
});

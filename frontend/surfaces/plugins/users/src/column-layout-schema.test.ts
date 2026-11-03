import { describe, expect, it } from 'vitest';

import { normalizeColumnLayout } from '@clouddrive/core';
import { parseUsersColumnLayoutPersisted } from './column-layout-schema';

describe('users column-layout 持久化校验', () => {
  it('只保留字符串 visibleOrder 并去重', () => {
    expect(
      parseUsersColumnLayoutPersisted({
        layouts: { 'mock-demo': { visibleOrder: ['name', 'email', 'email'] } },
      }),
    ).toEqual({ layouts: { 'mock-demo': { visibleOrder: ['name', 'email'] } } });
  });

  it('损坏记录抛错（不静默接受）', () => {
    expect(() => parseUsersColumnLayoutPersisted(null)).toThrow();
    expect(() => parseUsersColumnLayoutPersisted({ layouts: [] })).toThrow();
    expect(() =>
      parseUsersColumnLayoutPersisted({ layouts: { u: { visibleOrder: [1] } } }),
    ).toThrow();
    expect(() => parseUsersColumnLayoutPersisted({ layouts: { u: {} } })).toThrow();
  });

  it('恢复值与 normalizeColumnLayout 组合后过滤退役列、必选列置首', () => {
    const parsed = parseUsersColumnLayoutPersisted({
      layouts: { 'mock-demo': { visibleOrder: ['roles', 'retired', 'name'] } },
    });
    expect(
      normalizeColumnLayout(
        ['name', 'email', 'status', 'roles'],
        parsed.layouts['mock-demo']?.visibleOrder,
        new Set(['name']),
      ),
    ).toEqual(['name', 'roles']);
  });
});

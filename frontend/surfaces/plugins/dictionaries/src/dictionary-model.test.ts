import { describe, expect, it } from 'vitest';

import {
  createDemoDictionaries,
  dictionaryConsumerKey,
  isDictionaryCodeAvailable,
  parseDictionariesPersisted,
  sortDictionaryItems,
  validateDictionaryItemDraft,
  validateDictionaryTypeDraft,
  type DictionaryItem,
  type DictionaryType,
} from './dictionary-model';

const type: DictionaryType = {
  id: 'dict-a',
  name: '用户状态',
  code: 'USER_STATUS',
  status: 'active',
  remark: '',
  updatedAt: 1_700_000_000_000,
  version: 1,
};

const item: DictionaryItem = {
  id: 'item-a',
  typeId: 'dict-a',
  label: '启用',
  value: 'active',
  order: 0,
  status: 'active',
  tone: 'success',
  version: 1,
};

describe('dictionary validation', () => {
  it('accepts valid type drafts and normalizes whitespace', () => {
    expect(
      validateDictionaryTypeDraft({
        name: ' 用户状态 ',
        code: ' USER_STATUS ',
        status: 'active',
        remark: ' 备注 ',
      }),
    ).toEqual({
      ok: true,
      values: { name: '用户状态', code: 'USER_STATUS', status: 'active', remark: '备注' },
    });
  });

  it('rejects invalid names and codes', () => {
    expect(
      validateDictionaryTypeDraft({ name: 'x', code: 'user_status', status: 'active', remark: '' }),
    ).toEqual({
      ok: false,
      issues: { name: 'name-length', code: 'code-format' },
    });
    expect(
      validateDictionaryTypeDraft({
        name: '用户状态',
        code: 'USER_STATUS_A',
        status: 'active',
        remark: '',
      }).ok,
    ).toBe(true);
  });

  it('checks code uniqueness against other types only', () => {
    expect(isDictionaryCodeAvailable([type], 'USER_STATUS')).toBe(false);
    expect(isDictionaryCodeAvailable([type], 'USER_STATUS', 'dict-a')).toBe(true);
    expect(isDictionaryCodeAvailable([type], 'REGION')).toBe(true);
  });

  it('validates item fields and the 0–999 order range', () => {
    expect(
      validateDictionaryItemDraft({
        label: ' 启用 ',
        value: ' active ',
        order: '12',
        status: 'active',
        tone: 'success',
      }),
    ).toEqual({
      ok: true,
      values: { label: '启用', value: 'active', order: 12, status: 'active', tone: 'success' },
    });
    expect(
      validateDictionaryItemDraft({
        label: '',
        value: '',
        order: '1000',
        status: 'active',
        tone: 'success',
      }),
    ).toEqual({
      ok: false,
      issues: { label: 'label-length', value: 'value-length', order: 'order-range' },
    });
  });
});

describe('dictionary seed and helpers', () => {
  it('ships five demo types with items and stable consumer hints', () => {
    const demo = createDemoDictionaries();
    expect(demo.types).toHaveLength(5);
    expect(demo.items.length).toBeGreaterThan(10);
    expect(dictionaryConsumerKey('USER_STATUS')).toBe('userStatus');
    expect(dictionaryConsumerKey('UNKNOWN')).toBeNull();
  });

  it('sorts items by order then label', () => {
    const items = [
      { ...item, id: 'b', order: 2, label: 'B' },
      { ...item, id: 'a', order: 1, label: 'A' },
    ];
    expect(sortDictionaryItems(items).map((entry) => entry.id)).toEqual(['a', 'b']);
  });
});

describe('dictionaries persistence read', () => {
  it('accepts a valid record', () => {
    expect(parseDictionariesPersisted({ types: [type], items: [item] })).toEqual({
      types: [type],
      items: [item],
    });
  });

  it('rejects duplicate codes, orphan items, and unknown tones', () => {
    expect(() =>
      parseDictionariesPersisted({ types: [type, { ...type, id: 'dict-b' }], items: [] }),
    ).toThrow();
    expect(() =>
      parseDictionariesPersisted({ types: [type], items: [{ ...item, typeId: 'missing' }] }),
    ).toThrow();
    expect(() =>
      parseDictionariesPersisted({ types: [type], items: [{ ...item, tone: 'purple' }] }),
    ).toThrow();
  });
});

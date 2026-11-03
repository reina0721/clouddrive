import { describe, expect, it } from 'vitest';

import { normalizeColumnLayout, toCsv } from './table';

describe('normalizeColumnLayout', () => {
  const canonical = ['name', 'email', 'status', 'createdAt'];
  const mandatory = new Set(['name']);

  it('无保存值时回退 canonical 全列', () => {
    expect(normalizeColumnLayout(canonical, undefined, mandatory)).toEqual(canonical);
    expect(normalizeColumnLayout(canonical, [], mandatory)).toEqual(canonical);
  });

  it('保留用户可见顺序并去重、丢弃未知列', () => {
    expect(
      normalizeColumnLayout(canonical, ['email', 'email', 'retired', 'status'], mandatory),
    ).toEqual(['name', 'email', 'status']);
  });

  it('必选列按 canonical 顺序置首，即使保存序把它排在后面', () => {
    expect(normalizeColumnLayout(canonical, ['createdAt', 'name', 'status'], mandatory)).toEqual([
      'name',
      'createdAt',
      'status',
    ]);
  });

  it('保存值全部无效时回退 canonical 全列', () => {
    expect(normalizeColumnLayout(canonical, ['retired', 'gone'], mandatory)).toEqual(canonical);
  });

  it('只隐藏部分列时保留其余 canonical 列的用户顺序（缺失列 = 显式隐藏）', () => {
    expect(normalizeColumnLayout(canonical, ['name', 'status'], mandatory)).toEqual([
      'name',
      'status',
    ]);
  });
});

describe('toCsv', () => {
  const columns = [
    { id: 'name', label: '姓名' },
    { id: 'note', label: 'note' },
    { id: 'active', label: 'active' },
  ];

  it('输出表头 + 数据行，使用 CRLF 且顺序由 columns 决定', () => {
    const csv = toCsv([{ name: 'Rin', note: 'ok', active: true }], columns);
    expect(csv).toBe('姓名,note,active\r\nRin,ok,true\r\n');
  });

  it('RFC 4180：逗号、引号、换行与首尾空白都加引号并重复内部引号', () => {
    const csv = toCsv(
      [{ name: 'a,b', note: 'say "hi"', active: ' line\nbreak ' }],
      [columns[0]!, columns[1]!, columns[2]!],
    );
    expect(csv.split('\r\n')[1]).toBe('"a,b","say ""hi"""," line\nbreak "');
  });

  it('null / undefined / 缺失值输出空单元格', () => {
    expect(toCsv([{ name: null, note: undefined }], columns)).toBe('姓名,note,active\r\n,,\r\n');
  });

  it('没有列时返回空字符串，没有行时只有表头', () => {
    expect(toCsv([{ name: 'Rin' }], [])).toBe('');
    expect(toCsv([], columns)).toBe('姓名,note,active\r\n');
  });

  it('确定性：列顺序固定，不受对象 key 插入顺序影响', () => {
    const first = toCsv([{ active: false, note: 'n', name: 'R' }], columns);
    const second = toCsv([{ name: 'R', note: 'n', active: false }], columns);
    expect(first).toBe(second);
    expect(first.split('\r\n')[1]).toBe('R,n,false');
  });
});

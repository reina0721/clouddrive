import { describe, expect, it, vi } from 'vitest';
import {
  FilesError,
  decodeFileFilters,
  encodeFileFilters,
  fileFiltersSchema,
  fileSizeInput,
  fileViewPreferencesSchema,
  defaultFileViewPreferences,
  utcDateBoundary,
  utcInputDate,
  fileSelectionRange,
  nextFileFocus,
} from '@clouddrive/surface/files';
import { fileListParameters } from './query';
import { createFilesRuntime } from './backend';

describe('文件条件、偏好和选择契约', () => {
  it('重复参数保留逗号和零字节，不把未填条件当成零', () => {
    const params = fileListParameters({
      parent: '',
      search: '',
      category: '',
      trash: false,
      sort: 'name',
      desc: false,
      filters: { keywords: ['report,final', '报告'], minBytes: 0, maxBytes: 0, scope: 'all' },
      page: 2,
      pageSize: 50,
    });
    expect(params.getAll('keywords')).toEqual(['report,final', '报告']);
    expect(params.get('minBytes')).toBe('0');
    expect(params.get('page')).toBe('2');
    expect(params.has('createdFrom')).toBe(false);
  });
  it('URL条件往返保持类型，拒绝未知字段和过长编码', () => {
    const filters = {
      keywords: ['report'],
      extensions: ['.TXT'],
      minBytes: 0,
      scope: 'tree' as const,
    };
    expect(decodeFileFilters(encodeFileFilters(filters))).toEqual({
      ...filters,
      extensions: ['txt'],
    });
    for (const value of [
      'not-json',
      '{"keywords":[""]}',
      '{"scope":"public"}',
      '{"token":"not-a-search-field"}',
      '{"minBytes":-1}',
    ])
      expect(() => decodeFileFilters(value)).toThrow(FilesError);
    expect(() =>
      encodeFileFilters({ keywords: Array.from({ length: 8 }, () => '文'.repeat(255)) }),
    ).toThrow(FilesError);
  });
  it('UTC整日上界覆盖闰日，逆序与不可表示时刻不被取整', () => {
    const from = utcDateBoundary('2024-02-29', 'from'),
      through = utcDateBoundary('2024-02-29', 'through');
    expect(from).toBe('2024-02-29T00:00:00.000Z');
    expect(through).toBe('2024-03-01T00:00:00.000Z');
    expect(utcInputDate(through, 'through')).toBe('2024-02-29');
    expect(() => utcDateBoundary('2026-02-30', 'from')).toThrow(FilesError);
    expect(fileFiltersSchema.safeParse({ createdFrom: through, createdTo: from }).success).toBe(
      false,
    );
    expect(fileFiltersSchema.safeParse({ createdFrom: '2026-11-03T14:00:00.000Z' }).success).toBe(
      false,
    );
  });
  it('大小单位转换保留空值和精确整数，不接受负数或分数字节', () => {
    expect(fileSizeInput('', 'MiB')).toBeUndefined();
    expect(fileSizeInput('0', 'B')).toBe(0);
    expect(fileSizeInput('1.5', 'KiB')).toBe(1536);
    for (const invalid of ['-1', 'NaN', '1e100', '0.1'])
      expect(() => fileSizeInput(invalid, 'B')).toThrow(FilesError);
  });
  it('范围和方向只使用当前页，未知锚点不会沿用旧页索引', () => {
    const ids = ['a', 'b', 'c', 'd'];
    expect(fileSelectionRange(ids, 'd', 'b')).toEqual(['b', 'c', 'd']);
    expect(fileSelectionRange(ids, 'old', 'c')).toEqual(['c']);
    expect(fileSelectionRange(ids, 'a', 'old')).toEqual([]);
    expect(nextFileFocus(ids, 'a', 'previous')).toBe('a');
    expect(nextFileFocus(ids, 'd', 'next')).toBe('d');
    expect(nextFileFocus(ids, 'old', 'first')).toBe('a');
    expect(nextFileFocus([], 'old', 'last')).toBeUndefined();
  });
  it('偏好扩展使用集中默认，损坏数据和跨账号旧Host不会悄悄覆盖', async () => {
    const preference = fileViewPreferencesSchema.parse({ view: 'list', sort: 'name', desc: false });
    expect(preference.columns).toEqual(defaultFileViewPreferences.columns);
    expect(fileViewPreferencesSchema.safeParse({ ...preference, pageSize: 5000 }).success).toBe(
      false,
    );
    expect(
      fileViewPreferencesSchema.safeParse({ ...preference, columns: ['size', 'size'] }).success,
    ).toBe(false);
    let account: string | null = 'owner';
    const runtime = createFilesRuntime('/api', () => account, vi.fn(), vi.fn());
    localStorage.setItem('clouddrive.files.view.v1.owner', 'broken');
    await expect(runtime.port.loadPreferences()).rejects.toThrow(FilesError);
    localStorage.removeItem('clouddrive.files.view.v1.owner');
    const snapshot = await runtime.port.loadPreferences();
    expect(snapshot.configuration.defaults.pageSize).toBe(defaultFileViewPreferences.pageSize);
    account = 'other';
    await expect(runtime.port.savePreferences(snapshot)).rejects.toThrow(FilesError);
  });
});

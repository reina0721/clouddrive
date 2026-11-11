import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  annotationValuesSchema,
  annotationEncodedBytes,
  validateAnnotationValues,
  encodeFileFilters,
  decodeFileFilters,
  fileFiltersSchema,
  FilesError,
} from '@clouddrive/surface/files';
import { loadFileAnnotationMessages } from '@clouddrive/surface/files/runtime';
import { createAnnotationsPort } from './annotations';
import { fileListParameters } from './query';

const color = '#4589ab';
const limits = {
  maxBytes: 2048,
  maxTags: 8,
  maxProperties: 8,
  maxBatchEntries: 100,
  maxTagNameRunes: 32,
  maxPropertyKeyRunes: 64,
  maxPropertyValueRunes: 256,
  maxEmojiRunes: 16,
  maxPathBytes: 4096,
  defaultTagColor: color,
};
const values = {
  tags: [{ name: '工作,甲', color }],
  properties: [{ key: 'Empty', value: '' }],
  emoji: '📄',
  folderColor: '',
};
const entry = {
  id: 'entry',
  parentId: '',
  kind: 'file',
  name: 'sample.txt',
  sizeBytes: 3,
  mediaType: 'text/plain',
  createdAt: '2026-11-04T00:00:00Z',
  updatedAt: '2026-11-04T00:00:00Z',
  trashedAt: null,
  contentRevision: 1,
};
const document = { ...values, revision: 1, updatedAt: entry.updatedAt };
const detail = {
  entry,
  breadcrumbs: [],
  annotation: document,
  limits,
  statistics: { files: 1, folders: 0, shortcuts: 0, logicalBytes: 3 },
};
const summary = {
  entryId: 'entry',
  revision: 1,
  tags: values.tags,
  emoji: values.emoji,
  folderColor: '',
};
afterEach(() => vi.unstubAllGlobals());

describe('私有整理信息Host与契约', () => {
  it('正规化名称但保留空属性值，拒绝重复、系统键和CSS颜色', () => {
    expect(
      annotationValuesSchema.parse({
        ...values,
        tags: [{ name: 'Cafe\u0301', color: color.toUpperCase() }],
      }).tags,
    ).toEqual([{ name: 'Café', color }]);
    expect(validateAnnotationValues(values, limits, 'file').properties[0]?.value).toBe('');
    for (const invalid of [
      {
        ...values,
        tags: [
          { name: 'work', color },
          { name: 'WORK', color },
        ],
      },
      { ...values, tags: [{ name: 'bad', color: 'url(bad)' }] },
      { ...values, properties: [{ key: 'sys:shared_redirect', value: 'x' }] },
      { ...values, emoji: 'bad\n' },
    ])
      expect(annotationValuesSchema.safeParse(invalid).success).toBe(false);
    expect(() =>
      validateAnnotationValues({ ...values, folderColor: color }, limits, 'file'),
    ).toThrow(FilesError);
  });
  it('编码预算包括UTF8和Go HTML转义，配置降低后明确拒绝', () => {
    const escaped = {
      tags: [],
      properties: [{ key: 'HTML', value: '<>&\u2028\u2029文' }],
      emoji: '',
      folderColor: '',
    };
    const wire = '{"properties":[{"key":"HTML","value":"\\u003c\\u003e\\u0026\\u2028\\u2029文"}]}';
    expect(annotationEncodedBytes(escaped)).toBe(new TextEncoder().encode(wire).byteLength);
    expect(() => validateAnnotationValues(values, { ...limits, maxBytes: 10 }, 'file')).toThrow(
      FilesError,
    );
  });
  it('嵌套条件往返保留逗号、空值与匹配方式，按重复参数发送', () => {
    const filters = {
      scope: 'all' as const,
      tagFilter: { names: ['工作,甲', 'Café'], match: 'any' as const },
      property: { key: 'Empty', match: 'equals' as const, value: '' },
    };
    expect(decodeFileFilters(encodeFileFilters(filters))).toEqual(filters);
    const params = fileListParameters({
      parent: '',
      search: '',
      category: '',
      trash: false,
      sort: 'name',
      desc: false,
      filters,
    });
    expect(params.getAll('tags')).toEqual(['工作,甲', 'Café']);
    expect(params.get('tagMatch')).toBe('any');
    expect(params.has('propertyValue')).toBe(true);
    expect(params.get('propertyValue')).toBe('');
    for (const value of [
      { tagFilter: { names: [], match: 'all' } },
      { property: { key: 'Empty', match: 'exists', value: 'ignored' } },
      { property: { key: 'system:key', match: 'exists' } },
    ])
      expect(fileFiltersSchema.safeParse(value).success).toBe(false);
  });
  it('只复用注入客户端，读取与批量摘要校验目标身份', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce(detail)
      .mockResolvedValueOnce({ items: [summary] })
      .mockResolvedValueOnce({ items: [{ ...summary, entryId: 'foreign' }] });
    const port = createAnnotationsPort(call, vi.fn());
    expect((await port.read('entry')).annotation.revision).toBe(1);
    await port.summaries(['entry'], 'active');
    expect(
      new URLSearchParams(String(call.mock.calls[1]?.[0]).split('?')[1]).getAll('ids'),
    ).toEqual(['entry']);
    await expect(
      port.changeTags({ targets: [{ id: 'entry', revision: 1 }], add: values.tags, remove: [] }),
    ).rejects.toMatchObject({ code: 'invalid' });
  });
  it('账号变化后正在进行的读取不能把旧账号数据发布给新界面', async () => {
    let current = true,
      finish: (value: unknown) => void = () => {};
    const response = new Promise<unknown>((resolve) => {
      finish = resolve;
    });
    const port = createAnnotationsPort(
      () => response,
      () => {
        if (!current) throw new FilesError('canceled');
      },
    );
    const reading = port.read('entry');
    current = false;
    finish(detail);
    await expect(reading).rejects.toMatchObject({ code: 'canceled' });
  });
  it('剪贴板失败保留原因，不宣称复制成功', async () => {
    const cause = new Error('clipboard unavailable');
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(cause) } });
    const port = createAnnotationsPort(vi.fn(), vi.fn());
    await expect(port.copyText('/sample.txt')).rejects.toMatchObject({
      code: 'unavailable',
      cause,
    });
  });
  it('整理文案由文件运行域按需提供，包含两种语言', async () => {
    const resources = await loadFileAnnotationMessages();
    expect(resources['zh-CN']?.translation).toHaveProperty('files.annotations.save', '保存');
    expect(resources.en?.translation).toHaveProperty('files.annotations.save', 'Save');
    expect(resources['zh-CN']?.translation).toHaveProperty(
      'files.explorer.copyPending',
      '加入复制待处理',
    );
    expect(resources.en?.translation).toHaveProperty('files.explorer.copyPending', 'Queue copy');
  });
});

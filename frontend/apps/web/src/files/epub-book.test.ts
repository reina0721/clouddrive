import { describe, expect, it } from 'vitest';
import { epubLimits, isEpubDocument } from '@clouddrive/surface/files';
import { openEpubBook } from './epub-book';
import { resolveEpubPath } from './epub-package';
import { epubFixture } from '../test/epub-fixture';

const owner = () => new AbortController().signal;

describe('私有 EPUB 读取契约', () => {
  it('识别后缀和 MIME，包内路径限定在书中', () => {
    expect(isEpubDocument({ name: 'Book.EPUB', mediaType: 'application/octet-stream' })).toBe(true);
    expect(isEpubDocument({ name: 'Book', mediaType: 'application/epub+zip' })).toBe(true);
    expect(isEpubDocument({ name: 'Book.epub.zip', mediaType: 'application/zip' })).toBe(false);
    expect(resolveEpubPath('OPS/text/one.xhtml', '../two.xhtml#a%20b')).toEqual({
      path: 'OPS/two.xhtml',
      fragment: 'a b',
    });
    for (const value of [
      'https://example.test/a',
      '//example.test/a',
      '../../../a',
      '%2e%2e/%2e%2e/%2e%2e/a',
      'a?q=1',
    ])
      expect(resolveEpubPath('OPS/text/one.xhtml', value)).toBeUndefined();
  });

  it('读取 EPUB 3 和 EPUB 2 的目录，缺少目录时提供 spine', async () => {
    const signal = owner();
    for (const [mode, labels] of [
      ['nav', ['目录一', '目录二']],
      ['ncx', ['旧版目录']],
      ['spine', []],
    ] as const) {
      const book = await openEpubBook(await epubFixture(mode), signal, signal);
      expect(book.title).toBe('测试电子书');
      expect(book.author).toBe('示例作者');
      expect(book.chapters).toEqual(['OPS/text/one.xhtml', 'OPS/text/two.xhtml']);
      expect(book.toc.map((item) => item.label)).toEqual(labels);
      const chapter = await book.chapter(1, signal);
      expect(JSON.stringify(chapter.nodes)).toContain('章节二内容');
      chapter.release();
      book.release();
      await expect(book.chapter(0, signal)).rejects.toMatchObject({ code: 'canceled' });
    }
  });

  it('拒绝损坏的容器、超额书籍及超额章节', async () => {
    const signal = owner();
    await expect(openEpubBook(new ArrayBuffer(16), signal, signal)).rejects.toMatchObject({
      code: 'unsupported',
    });
    await expect(
      openEpubBook(new ArrayBuffer(epubLimits.fileBytes + 1), signal, signal),
    ).rejects.toMatchObject({ code: 'large' });
    const book = await openEpubBook(await epubFixture('nav', epubLimits.xmlBytes), signal, signal);
    await expect(book.chapter(0, signal)).rejects.toMatchObject({ code: 'large' });
    book.release();
  });
});

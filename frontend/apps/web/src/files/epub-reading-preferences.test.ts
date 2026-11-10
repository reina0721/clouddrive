import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultEpubReadingState, FilesError } from '@clouddrive/surface/files';
import { createEpubReadingPreferences } from './epub-reading-preferences';

const book = {
  id: 'book',
  name: 'book.epub',
  mediaType: 'application/epub+zip',
  sizeBytes: 24,
  contentRevision: 1,
};
const reading = { ...defaultEpubReadingState, position: { chapter: 1, ratio: 0.5 } };

describe('本机 EPUB 阅读记录', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('按账号与文件隔离，阻止已经退出的账号继续读写', () => {
    let signedIn = true;
    const first = createEpubReadingPreferences('reader', () => {
      if (!signedIn) throw new FilesError('canceled');
    });
    const second = createEpubReadingPreferences('reader.test', vi.fn());
    first.save(book, reading);
    expect(first.load(book)).toEqual(reading);
    expect(first.load({ ...book, id: 'another' })).toBeUndefined();
    expect(second.load(book)).toBeUndefined();
    signedIn = false;
    expect(() => first.load(book)).toThrow(FilesError);
    expect(() => first.save(book, defaultEpubReadingState)).toThrow(FilesError);
  });

  it('新版从头读取，旧标签页的延迟写入不会覆盖已保存的新版', () => {
    const port = createEpubReadingPreferences('reader', vi.fn());
    const revised = { ...book, contentRevision: 2 };
    port.save(book, reading);
    expect(port.load(revised)).toBeUndefined();
    port.save(revised, defaultEpubReadingState);
    port.save(book, reading);
    expect(port.load(book)).toBeUndefined();
    expect(port.load(revised)).toEqual(defaultEpubReadingState);
  });

  it('每个账号只保留最近阅读的 64 本书', () => {
    const port = createEpubReadingPreferences('reader', vi.fn());
    const other = createEpubReadingPreferences('reader.test', vi.fn());
    other.save(book, reading);
    let nowMs = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
    port.save(book, reading);
    for (let index = 0; index < 64; index += 1) {
      port.save({ ...book, id: String(index) }, reading);
    }
    expect(port.load(book)).toBeUndefined();
    expect(port.load({ ...book, id: '0' })).toEqual(reading);
    expect(other.load(book)).toEqual(reading);
  });

  it('浏览器拒绝写入时保留原始错误', () => {
    const port = createEpubReadingPreferences('reader', vi.fn());
    const cause = new DOMException('storage unavailable', 'SecurityError');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw cause;
    });
    expect(() => port.save(book, reading)).toThrow(expect.objectContaining({ cause }));
  });
});

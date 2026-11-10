import { describe, expect, it } from 'vitest';
import { decodeFileText } from './text-source';

describe('本人代码文件的严格解码', () => {
  it('识别 UTF-8 与 UTF-16 BOM 并保留统一换行信息', () => {
    expect(decodeFileText(Uint8Array.of(0xef, 0xbb, 0xbf, 65, 13, 10, 66), 'auto')).toEqual({
      text: 'A\nB',
      encoding: 'utf-8',
      lineEnding: '\r\n',
    });
    expect(decodeFileText(Uint8Array.of(0xfe, 0xff, 0, 65, 0, 13, 0, 66), 'auto')).toEqual({
      text: 'A\nB',
      encoding: 'utf-16be',
      lineEnding: '\r',
    });
    expect(decodeFileText(Uint8Array.of(0xff, 0xfe, 65, 0), 'auto').text).toBe('A');
  });

  it('历史编码必须显式选择，并拒绝二进制控制字符', () => {
    const legacy = Uint8Array.of(0xd6, 0xd0, 0xce, 0xc4);
    expect(() => decodeFileText(legacy, 'auto')).toThrow(
      expect.objectContaining({ code: 'invalid' }),
    );
    expect(decodeFileText(legacy, 'gb18030').text).toBe('中文');
    expect(() => decodeFileText(Uint8Array.of(65, 0, 66), 'windows-1252')).toThrow(
      expect.objectContaining({ code: 'unsupported' }),
    );
  });

  it('将混合换行规范为 LF', () => {
    expect(decodeFileText(new TextEncoder().encode('A\r\nB\nC'), 'auto')).toEqual({
      text: 'A\nB\nC',
      encoding: 'utf-8',
      lineEnding: '\n',
    });
  });
});

import {
  FilesError,
  type DecodedFileText,
  type TextEncoding,
  type TextLineEnding,
} from '@clouddrive/surface/files';

function unicodeEncoding(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  return 'utf-8';
}

/** decodeFileText 严格解码原始字节，保留可无歧义恢复的文件换行。 */
export function decodeFileText(bytes: Uint8Array, requested: TextEncoding): DecodedFileText {
  const encoding = requested === 'auto' ? unicodeEncoding(bytes) : requested;
  let text: string;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch (error) {
    throw new FilesError('invalid', { cause: error });
  }
  if (/[^\P{Cc}\t\n\r\f]/u.test(text)) throw new FilesError('unsupported');
  let lineEnding: TextLineEnding | undefined;
  for (const [ending] of text.matchAll(/\r\n|\r|\n/g)) {
    if (lineEnding && ending !== lineEnding) {
      lineEnding = '\n';
      break;
    }
    lineEnding = ending as TextLineEnding;
  }
  return { encoding, lineEnding: lineEnding ?? '\n', text: text.replace(/\r\n?/g, '\n') };
}

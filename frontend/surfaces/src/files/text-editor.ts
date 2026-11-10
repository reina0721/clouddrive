export const textEncodings = [
  ['auto', 'Auto'],
  ['utf-8', 'UTF-8'],
  ['utf-16le', 'UTF-16 LE'],
  ['utf-16be', 'UTF-16 BE'],
  ['gb18030', 'GB18030 / GBK'],
  ['big5', 'Big5'],
  ['shift_jis', 'Shift_JIS'],
  ['windows-1252', 'Windows-1252'],
] as const;

export type TextEncoding = (typeof textEncodings)[number][0];
export type TextLineEnding = '\n' | '\r\n' | '\r';
export type DecodedFileText = Readonly<{
  text: string;
  encoding: Exclude<TextEncoding, 'auto'>;
  lineEnding: TextLineEnding;
}>;
export type FileTextSource = Readonly<{
  decode(encoding: TextEncoding): DecodedFileText;
}>;

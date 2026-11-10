const wavMediaType = 'audio/wav';
const audioMediaTypes = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  wavMediaType,
  'audio/x-wav',
  'audio/flac',
  'audio/aac',
]);

export function audioMediaType(value: string) {
  const type = value.split(';')[0]?.toLowerCase();
  // Go 的内容识别使用 audio/wave，浏览器探针使用 WAV 通用别名。
  if (type === 'audio/wave') return wavMediaType;
  return type && audioMediaTypes.has(type) ? type : undefined;
}

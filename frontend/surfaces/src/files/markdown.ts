export const markdownReadTimeoutMs = 20000;
export const markdownImageMaxBytes = 2 * 1024 * 1024;
const maxFilenameCharacters = 255;
const maxEncodedImagePathCharacters = maxFilenameCharacters * 12 + 2;

export function isMarkdownFile(entry: { name: string; mediaType: string }) {
  return (
    /\.(md|markdown)$/i.test(entry.name) ||
    entry.mediaType.split(';', 1)[0]?.trim().toLowerCase() === 'text/markdown'
  );
}

export function markdownSiblingName(source: string) {
  if (!source || source.length > maxEncodedImagePathCharacters) return undefined;
  try {
    const name = decodeURIComponent(source.replace(/^\.\//, '')).normalize('NFC');
    if (
      !name ||
      name === '.' ||
      name === '..' ||
      name.trim() !== name ||
      [...name].length > maxFilenameCharacters ||
      /[\\/:?#]/.test(name) ||
      [...name].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    )
      return undefined;
    return name;
  } catch {
    return undefined;
  }
}

export function markdownImagePath(name: string) {
  try {
    const encoded = './' + encodeURIComponent(name).replaceAll('(', '%28').replaceAll(')', '%29');
    return markdownSiblingName(encoded) ? encoded : undefined;
  } catch {
    return undefined;
  }
}

export function markdownHttpLink(value: string) {
  try {
    const url = new URL(value);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password)
      return url.href;
  } catch {
    return undefined;
  }
  return undefined;
}

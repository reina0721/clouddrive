export const markdownReadTimeoutMs = 20000;

export function isMarkdownFile(entry: { name: string; mediaType: string }) {
  return (
    /\.(md|markdown)$/i.test(entry.name) ||
    entry.mediaType.split(';', 1)[0]?.trim().toLowerCase() === 'text/markdown'
  );
}

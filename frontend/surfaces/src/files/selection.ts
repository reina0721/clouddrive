/** fileSelectionRange 仅使用当前页的稳定ID，不把旧索引应用到新结果。 */
export function fileSelectionRange(
  ids: readonly string[],
  anchor: string,
  target: string,
): readonly string[] {
  const start = ids.indexOf(anchor),
    end = ids.indexOf(target);
  if (end < 0) return [];
  if (start < 0) return [target];
  return ids.slice(Math.min(start, end), Math.max(start, end) + 1);
}
export function nextFileFocus(
  ids: readonly string[],
  current: string,
  direction: 'next' | 'previous' | 'first' | 'last',
): string | undefined {
  if (!ids.length) return undefined;
  if (direction === 'first') return ids[0];
  if (direction === 'last') return ids.at(-1);
  const currentIndex = ids.indexOf(current);
  if (currentIndex < 0) return direction === 'previous' ? ids.at(-1) : ids[0];
  return ids[Math.max(0, Math.min(ids.length - 1, currentIndex + (direction === 'next' ? 1 : -1)))];
}

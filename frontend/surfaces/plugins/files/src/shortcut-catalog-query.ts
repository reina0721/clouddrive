import type { SavedShareFilter } from '../../../src/files/navigation';

export type ShortcutCatalogQuery = Readonly<{
  search: string;
  state: SavedShareFilter;
  cursor: string;
}>;

/** 游标只标识自己的目录项，不把分享链接或保存意图片段带进检索地址。 */
export function readShortcutCatalogQuery(params: {
  get(key: string): string | null;
}): ShortcutCatalogQuery {
  const state = params.get('state');
  return {
    search: (params.get('search') ?? '').trim(),
    state: state === 'active' || state === 'protected' || state === 'unavailable' ? state : '',
    cursor: params.get('cursor') ?? '',
  };
}

export function shortcutCatalogHref(path: string, query: ShortcutCatalogQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.state) params.set('state', query.state);
  if (query.cursor) params.set('cursor', query.cursor);
  return path + (params.size ? '?' + params.toString() : '');
}

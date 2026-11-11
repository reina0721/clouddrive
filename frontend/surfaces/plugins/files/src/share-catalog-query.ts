import type { ShareQuery } from '../../../src/files/model';

/** 分享检索属于此路由；不复用文件目录的筛选编码。 */
export function readShareCatalogQuery(params: { get(key: string): string | null }): ShareQuery {
  const state = params.get('state') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const page = Number(params.get('page') ?? '1');
  return {
    search: (params.get('search') ?? '').trim(),
    state:
      state === 'active' || state === 'paused' || state === 'expired' || state === 'revoked'
        ? state
        : '',
    sort: sort === 'oldest' || sort === 'name' ? sort : 'newest',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function shareCatalogHref(path: string, query: ShareQuery) {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.state) params.set('state', query.state);
  if (query.sort !== 'newest') params.set('sort', query.sort);
  if (query.page > 1) params.set('page', String(query.page));
  return path + (params.size ? '?' + params.toString() : '');
}

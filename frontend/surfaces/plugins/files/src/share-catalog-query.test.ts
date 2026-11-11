import { describe, expect, it } from 'vitest';
import { readShareCatalogQuery, shareCatalogHref } from './share-catalog-query';

describe('分享管理地址', () => {
  it('保留中文检索、状态、排序和页码，可用于重新打开或浏览器返回', () => {
    const query = {
      search: '项目交接 & 资料',
      state: 'paused' as const,
      sort: 'name' as const,
      page: 3,
    };
    const href = shareCatalogHref('/home/shares', query);
    expect(readShareCatalogQuery(new URL(href, 'https://example.test').searchParams)).toEqual(
      query,
    );
    expect(href).not.toContain('token');
  });
  it('不把外部无效状态、排序或页码发送给服务端', () => {
    for (const page of ['0', '-2', 'NaN', 'Infinity', '1.5', '9007199254740992']) {
      expect(
        readShareCatalogQuery(
          new URLSearchParams({ search: '  交接  ', state: 'all', sort: 'invalid', page }),
        ),
      ).toEqual({ search: '交接', state: '', sort: 'newest', page: 1 });
    }
  });
  it('缺省视图保持简洁地址，不混入文件目录或分享凭据', () => {
    const query = readShareCatalogQuery(new URLSearchParams('parent=private&token=secret'));
    expect(shareCatalogHref('/home/shares', query)).toBe('/home/shares');
  });
});

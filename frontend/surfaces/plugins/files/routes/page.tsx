'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { decodeFileFilters, fileSearchLimits } from '../../../src/files/search';
import { FilesPage } from '../src/files-page';

export default function FilesRoute() {
  const params = useSearchParams();
  const router = useRouter();
  const rawFilter = params.get('filter'),
    rawPage = params.get('page'),
    cursor = params.get('cursor') ?? '';
  const query = useMemo(() => {
    try {
      const filters = decodeFileFilters(rawFilter);
      if (
        rawPage !== null &&
        (!/^[1-9]\d*$/.test(rawPage) || Number(rawPage) > fileSearchLimits.maxPage)
      )
        throw new Error('invalid page');
      if (
        cursor &&
        (rawPage !== null || !/^[np]\.[\w-]+\.[\w-]{43}$/.test(cursor) || cursor.length > 120)
      )
        throw new Error('invalid cursor');
      return { filters, page: rawPage === null ? 1 : Number(rawPage), invalid: false };
    } catch {
      return { filters: {}, page: 1, invalid: true };
    }
  }, [rawFilter, rawPage, cursor]);
  return (
    <FilesPage
      parent={params.get('parent') ?? ''}
      category={params.get('category') ?? ''}
      trash={params.get('trash') === 'true'}
      search={params.get('search') ?? ''}
      filters={query.filters}
      page={query.page}
      numbered={rawPage !== null}
      cursor={cursor}
      queryInvalid={query.invalid}
      navigate={(query) => {
        const next = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) if (value) next.set(key, value);
        router.push(`/home${next.size ? `?${next}` : ''}`);
      }}
    />
  );
}

'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { FilesPage } from '../src/files-page';

export default function FilesRoute() {
  const params = useSearchParams();
  const router = useRouter();
  return (
    <FilesPage
      parent={params.get('parent') ?? ''}
      category={params.get('category') ?? ''}
      trash={params.get('trash') === 'true'}
      search={params.get('search') ?? ''}
      navigate={(query) => {
        const next = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) if (value) next.set(key, value);
        router.push(`/home${next.size ? `?${next}` : ''}`);
      }}
    />
  );
}

'use client';
import { useSearchParams } from 'next/navigation';
import { InboxPage } from '../../src/inbox-page';
import { useIdentityQuery } from '../../../../src/identity/use-query';
import { IdentityError } from '@clouddrive/surface/identity/runtime';
import { IdentityQueryState } from '../../../../src/identity/query-state';

export default function NotificationDetailRoute() {
  const params = useSearchParams();
  const parsed = useIdentityQuery(`notifications.params:${params.toString()}`, async () => {
    const { inboxQuerySchema } = await import('../../src/query');
    const query = inboxQuerySchema.safeParse({
      q: params.get('q') ?? '',
      category: params.get('category') ?? 'all',
      read: params.get('read') ?? 'all',
      page: params.has('page') ? Number(params.get('page')) : 1,
    });
    if (!query.success) throw new IdentityError('validation');
    return query.data;
  });
  if (!parsed.data) return <IdentityQueryState error={parsed.error} retry={parsed.reload} />;
  return <InboxPage key={params.toString()} id={params.get('id') ?? ''} query={parsed.data} />;
}

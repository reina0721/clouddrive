'use client';
import { useSearchParams } from 'next/navigation';
import { IdentityError, defaultAuditQuery } from '@clouddrive/surface/identity/runtime';
import { useIdentityQuery } from '../../../src/identity/use-query';
import { IdentityQueryState } from '../../../src/identity/query-state';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { AuditPage } from '../src/audit-page';
export default function AuditRoute() {
  const params = useSearchParams();
  const { t } = useFrontendTranslation();
  const parsed = useIdentityQuery(`audit.params:${params.toString()}`, async () => {
    const { auditQuerySchema } = await import('../../../src/identity/model');
    const query = auditQuerySchema.safeParse({
      q: params.get('q') ?? '',
      actor: params.get('actor') ?? '',
      object: params.get('object') ?? '',
      from: params.get('from') ?? '',
      to: params.get('to') ?? '',
      operation: params.get('operation') ?? 'all',
      result: params.get('result') ?? 'all',
      page: params.has('page') ? Number(params.get('page')) : defaultAuditQuery.page,
      pageSize: params.has('pageSize')
        ? Number(params.get('pageSize'))
        : defaultAuditQuery.pageSize,
    });
    if (!query.success) throw new IdentityError('validation');
    return query.data;
  });
  return parsed.data ? (
    <AuditPage key={params.toString()} query={parsed.data} />
  ) : (
    <Page>
      <PageHeader title={t('audit.nav')} description={t('audit.description')} />
      <IdentityQueryState error={parsed.error} retry={parsed.reload} />
    </Page>
  );
}

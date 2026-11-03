'use client';
import { useFrontendTranslation, formatDate, formatTimeOfDay } from '@clouddrive/i18n';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { route, RouteLink } from '@clouddrive/plugin-framework/plugin';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import type { Preferences } from '@clouddrive/surface/preferences-model';
import { IdentityError, useIdentityPort } from '@clouddrive/surface/identity/runtime';
import { useIdentityQuery } from '../../../src/identity/use-query';
import { IdentityModeNotice, IdentityQueryState } from '../../../src/identity/query-state';
export function AuditDetailPage({
  id,
  backQuery,
}: Readonly<{ id: string | null; backQuery?: Readonly<Record<string, string>> }>) {
  const { t, locale } = useFrontendTranslation();
  const preferences = usePreferencesPort<Preferences>().getSnapshot();
  const port = useIdentityPort();
  const result = useIdentityQuery(`audit.detail:${id}`, async (service) => {
    const { identifierSchema } = await import('../../../src/identity/model');
    if (!id || !identifierSchema.safeParse(id).success) throw new IdentityError('not-found');
    const access = await service.access();
    if (!access.permissions.includes('audit.read')) throw new IdentityError('forbidden');
    return service.readAudit(id);
  });
  const record = result.data;
  return (
    <Page>
      <PageHeader
        title={t('audit.detail')}
        description={t('audit.readonly')}
        actions={
          <RouteLink target={route('audit', {}, { query: backQuery ?? {} })}>
            {t('audit.back')}
          </RouteLink>
        }
      />
      <IdentityModeNotice mode={port.mode} />
      {result.error || !record ? (
        <IdentityQueryState error={result.error} retry={result.reload} />
      ) : (
        <Section title={t(`management.operations.${record.operation}`)}>
          <div className="p-5">
            <DescriptionList
              label={t('audit.detail')}
              columns={2}
              items={[
                { id: 'id', term: t('audit.id'), description: record.id },
                {
                  id: 'actor',
                  term: t('audit.actor'),
                  description: `${record.actorName} (${record.actorId})`,
                },
                {
                  id: 'object',
                  term: t('audit.object'),
                  description: `${record.objectName} (${record.objectId})`,
                },
                {
                  id: 'time',
                  term: t('audit.time'),
                  description: `${formatDate(locale, record.createdAt, preferences.localeRegion.timeZone === 'auto' ? {} : { timeZone: preferences.localeRegion.timeZone })} ${formatTimeOfDay(locale, preferences.localeRegion, record.createdAt)}`,
                },
                { id: 'result', term: t('audit.result'), description: t(`audit.${record.result}`) },
                ...(record.errorCode
                  ? [
                      {
                        id: 'error',
                        term: t('audit.error'),
                        description: t(`identityProduct.errors.${record.errorCode}`),
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        </Section>
      )}
    </Page>
  );
}

'use client';
import { useFrontendTranslation, formatDate, formatNumber } from '@clouddrive/i18n';
import { Section } from '@clouddrive/surface-foundation/layout';
import { DataTable } from '@clouddrive/ui-adapter/data-display';
import type { Dashboard } from './model';
export function DashboardSummary({
  value,
  daily = false,
}: Readonly<{ value: Dashboard | null; daily?: boolean }>) {
  const { t, locale } = useFrontendTranslation();
  return (
    <>
      <Section title={t('administration.analytics')}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt>{t('administration.users')}</dt>
            <dd>
              {value?.users === null
                ? t('administration.empty')
                : formatNumber(locale, value?.users ?? 0)}
            </dd>
          </div>
          <div>
            <dt>{t('administration.roles')}</dt>
            <dd>
              {value?.roles === null
                ? t('administration.empty')
                : formatNumber(locale, value?.roles ?? 0)}
            </dd>
          </div>
        </dl>
      </Section>
      {daily ? (
        <Section title={t('administration.operations')}>
          <DataTable
            label={t('administration.operations')}
            columns={[
              {
                id: 'date',
                label: t('administration.date'),
                rowHeader: true,
                render: (row) => formatDate(locale, row.time, { timeZone: 'UTC' }),
              },
              {
                id: 'count',
                label: t('administration.count'),
                render: (row) => formatNumber(locale, row.count),
              },
            ]}
            rows={(value?.dailyOperations.some((row) => row.count > 0)
              ? value.dailyOperations
              : []
            ).map((row) => ({ ...row, id: String(row.time) }))}
            emptyContent={t('administration.empty')}
          />
        </Section>
      ) : null}
    </>
  );
}

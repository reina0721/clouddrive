'use client';

import { formatNumber, useFrontendTranslation } from '@clouddrive/i18n';
import { Section } from '@clouddrive/surface-foundation/layout';
import { BarChart, DonutChart, type ChartSegment } from '@clouddrive/ui-adapter/charts';
import { ProgressMeter } from '@clouddrive/ui-adapter/progress-meter';

import type { AnalyticsDataset } from './analytics-data';

/**
 * 三张次级卡片：访问来源（donut + 图例/百分比）、设备分布（横向 bar）、
 * 页面排行（Top 5 语义表格 + 进度条）。数值与占比都来自同一数据集。
 */
export function AnalyticsBreakdowns({ dataset }: Readonly<{ dataset: AnalyticsDataset }>) {
  const { t, locale } = useFrontendTranslation();
  const formatValue = (value: number): string => formatNumber(locale, value);
  const formatShare = (share: number): string =>
    formatNumber(locale, share, { style: 'percent', maximumFractionDigits: 1 });

  const sourceSegments: readonly ChartSegment[] = dataset.sources.map((source) => ({
    id: source.id,
    label: t(`analytics.sources.${source.id}`),
    value: source.value,
  }));
  const deviceSegments: readonly ChartSegment[] = dataset.devices.map((device) => ({
    id: device.id,
    label: t(`analytics.devices.${device.id}`),
    value: device.value,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-3" data-reveal-items>
      <Section
        contentInset
        description={t('analytics.sources.description')}
        title={t('analytics.sources.title')}
      >
        <DonutChart
          formatShare={formatShare}
          formatValue={formatValue}
          label={t('analytics.sources.chartLabel')}
          segments={sourceSegments}
        />
      </Section>

      <Section
        contentInset
        description={t('analytics.devices.description')}
        title={t('analytics.devices.title')}
      >
        <BarChart
          formatShare={formatShare}
          formatValue={formatValue}
          items={deviceSegments}
          label={t('analytics.devices.chartLabel')}
        />
      </Section>

      <Section
        contentInset
        description={t('analytics.pages.description')}
        title={t('analytics.pages.title')}
      >
        <table className="w-full text-sm">
          <caption className="sr-only">{t('analytics.pages.caption')}</caption>
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
              <th className="pb-2 text-start font-semibold" scope="col">
                {t('analytics.pages.column.page')}
              </th>
              <th className="pb-2 text-end font-semibold" scope="col">
                {t('analytics.pages.column.views')}
              </th>
            </tr>
          </thead>
          <tbody>
            {dataset.pages.map((page) => (
              <tr className="border-b border-border/60 last:border-b-0" key={page.id}>
                <th className="min-w-0 py-3 pe-3 text-start font-normal" scope="row">
                  <span className="block truncate text-xs font-semibold text-ink">{page.path}</span>
                  <span className="mt-2 block">
                    <ProgressMeter label={t('analytics.pages.share')} value={page.share * 100} />
                  </span>
                </th>
                <td className="py-3 text-end align-top tabular-nums text-ink">
                  {formatValue(page.views)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

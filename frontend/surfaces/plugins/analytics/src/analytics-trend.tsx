'use client';

import { formatDate, formatNumber, useFrontendTranslation } from '@clouddrive/i18n';
import { Section } from '@clouddrive/surface-foundation/layout';
import { TabsView } from '@clouddrive/ui-adapter/data-display';
import { AreaChart, type ChartSeries } from '@clouddrive/ui-adapter/charts';
import { useState } from 'react';

import type { AnalyticsDataset } from './analytics-data';

type TrendTab = 'traffic' | 'visitors';

/**
 * 趋势卡片：TabsView 切换「流量趋势 / 访问数量」，两个 tab 都是同一确定性数据集
 * 的切片。Tab 状态留在本组件（页面范围切换不重置当前指标）。
 */
export function AnalyticsTrend({ dataset }: Readonly<{ dataset: AnalyticsDataset }>) {
  const { t, locale } = useFrontendTranslation();
  const [activeTab, setActiveTab] = useState<TrendTab>('traffic');

  const formatValue = (value: number): string =>
    formatNumber(locale, value, { notation: 'compact', maximumFractionDigits: 1 });
  const formatX = (x: number): string => formatDate(locale, x, { month: 'short', day: 'numeric' });

  const toSeries = (entries: AnalyticsDataset['traffic']): readonly ChartSeries[] =>
    entries.map((entry) => ({
      id: entry.id,
      label: t(`analytics.metric.${entry.id}`),
      points: entry.points,
    }));

  const summary = t('analytics.trend.summary', { range: dataset.range });

  return (
    <Section
      contentInset
      description={t('analytics.trend.description')}
      title={t('analytics.trend.title')}
    >
      <TabsView
        items={[
          {
            id: 'traffic',
            label: t('analytics.trend.tab.traffic'),
            content: (
              <AreaChart
                formatValue={formatValue}
                formatX={formatX}
                label={t('analytics.trend.chart.traffic')}
                series={toSeries(dataset.traffic)}
                summary={summary}
              />
            ),
          },
          {
            id: 'visitors',
            label: t('analytics.trend.tab.visitors'),
            content: (
              <AreaChart
                formatValue={formatValue}
                formatX={formatX}
                label={t('analytics.trend.chart.visitors')}
                series={toSeries(dataset.visitors)}
                summary={summary}
              />
            ),
          },
        ]}
        label={t('analytics.trend.tabsLabel')}
        onSelectionChange={(id) => setActiveTab(id === 'visitors' ? 'visitors' : 'traffic')}
        selectedId={activeTab}
      />
    </Section>
  );
}

'use client';

import { formatNumber, useFrontendTranslation } from '@clouddrive/i18n';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { Sparkline, type SparklineTone } from '@clouddrive/ui-adapter/charts';
import { ArrowDownRight, ArrowUpRight, Download, Eye, Gauge, Users } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

import type { AnalyticsKpi, AnalyticsMetricId } from './analytics-data';

const METRIC_ICONS: Readonly<Record<AnalyticsMetricId, ComponentType<SVGProps<SVGSVGElement>>>> = {
  users: Users,
  visits: Eye,
  downloads: Download,
  usage: Gauge,
};

const METRIC_TONES: Readonly<Record<AnalyticsMetricId, SparklineTone>> = {
  users: 'brand',
  visits: 'info',
  downloads: 'success',
  usage: 'warning',
};

/**
 * 四张 KPI 卡片：当前值、环比 delta（语义色 + 方向图标 + 屏幕阅读器文本）、
 * 图标、sparkline 趋势与「总量」次要指标。
 */
export function AnalyticsKpiGrid({ kpis }: Readonly<{ kpis: readonly AnalyticsKpi[] }>) {
  const { t, locale } = useFrontendTranslation();
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-reveal-items>
      {kpis.map((kpi) => {
        const Icon = METRIC_ICONS[kpi.id];
        const metricLabel = t(`analytics.kpi.${kpi.id}.label`);
        const rising = kpi.deltaRatio >= 0;
        const DeltaIcon = rising ? ArrowUpRight : ArrowDownRight;
        const deltaLabel = formatNumber(locale, kpi.deltaRatio, {
          style: 'percent',
          maximumFractionDigits: 1,
          signDisplay: 'always',
        });
        return (
          <Panel appearance="outlined" className="grid content-start gap-3 p-5" key={kpi.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {metricLabel}
                </p>
                <p className="mt-2 text-2xl font-extrabold tabular-nums text-ink">
                  {formatNumber(locale, kpi.value)}
                </p>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-control bg-brand-soft text-brand">
                <Icon aria-hidden="true" className="size-icon" />
              </span>
            </div>
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1 font-semibold tabular-nums ${
                  rising ? 'text-success' : 'text-danger'
                }`}
              >
                <DeltaIcon aria-hidden="true" className="size-icon-sm" />
                <span className="sr-only">
                  {rising ? t('analytics.kpi.up') : t('analytics.kpi.down')}
                </span>
                {deltaLabel}
              </span>
              <span className="text-ink-muted">{t('analytics.kpi.vsPrevious')}</span>
            </p>
            <Sparkline
              formatValue={(value) => formatNumber(locale, value)}
              label={t('analytics.kpi.sparklineLabel', { metric: metricLabel })}
              tone={METRIC_TONES[kpi.id]}
              values={kpi.points.map((point) => point.y)}
            />
            <p className="text-xs text-ink-muted">
              {t('analytics.kpi.total')}{' '}
              <span className="font-semibold tabular-nums text-ink">
                {formatNumber(locale, kpi.lifetimeTotal)}
              </span>
            </p>
          </Panel>
        );
      })}
    </div>
  );
}

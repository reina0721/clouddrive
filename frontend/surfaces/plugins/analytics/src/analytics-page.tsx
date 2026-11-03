'use client';

import { formatNumber, useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { AsyncRegion, type AsyncRegionPhase } from '@clouddrive/ui-adapter/async-region';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { Skeleton } from '@clouddrive/ui-adapter/skeleton';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { ToggleGroup } from '@clouddrive/ui-adapter/toggle-group';
import { Inbox, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AnalyticsBreakdowns } from './analytics-breakdowns';
import {
  ANALYTICS_RANGES,
  buildAnalyticsDataset,
  isAnalyticsRange,
  type AnalyticsRange,
} from './analytics-data';
import { AnalyticsKpiGrid } from './analytics-kpi-grid';
import { AnalyticsTrend } from './analytics-trend';

/** 演示用异步时延：让 Loading / Refreshing 状态真实可达，而不是"仅存在于设计稿"。 */
const DEMO_LATENCY_MS = 480;

const DEMO_OPTION_EMPTY = 'empty';
const DEMO_OPTION_FAILURE = 'failure';

type AnalyticsViewPhase = AsyncRegionPhase;

function AnalyticsLoading() {
  const { t } = useFrontendTranslation();
  return (
    <div aria-label={t('analytics.async.loading')} className="grid gap-4" role="status">
      <span className="sr-only">{t('analytics.async.loading')}</span>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton className="h-40 w-full" key={index} />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton className="h-56 w-full" key={index} />
        ))}
      </div>
    </div>
  );
}

/**
 * 分析页（VP-06）。
 *
 * 页面结构：PageHeader → 演示数据声明 → Toolbar（范围 + 演示开关 + 刷新）→
 * AsyncRegion（KPI / 趋势 / 三张次级卡片）。
 *
 * 状态可演示性：初始加载有真实 Loading，刷新可失败（`模拟刷新失败`），空数据由
 * `演示空数据` 触发；三种状态都能从 Toolbar 到达，并且都提供恢复路径。
 */
export function AnalyticsPage() {
  const { t, locale } = useFrontendTranslation();
  const [range, setRange] = useState<AnalyticsRange>(30);
  const [demoEmpty, setDemoEmpty] = useState(false);
  const [failRefresh, setFailRefresh] = useState(false);
  const [pending, setPending] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastRequestFailed, setLastRequestFailed] = useState(false);

  // 演示请求：pending 为 true 时安排一次"请求"，结果是成功或注入的失败。
  // setState 只发生在计时器回调里（不在 effect 体内同步 setState）。
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => {
      setLastRequestFailed(failRefresh);
      setHasLoaded(true);
      setPending(false);
    }, DEMO_LATENCY_MS);
    return () => window.clearTimeout(timer);
  }, [failRefresh, pending]);

  const phase: AnalyticsViewPhase = pending
    ? hasLoaded
      ? 'refreshing'
      : 'initial'
    : lastRequestFailed
      ? 'error'
      : demoEmpty
        ? 'empty'
        : 'ready';

  const dataset = useMemo(
    () => buildAnalyticsDataset({ range, empty: demoEmpty }),
    [demoEmpty, range],
  );

  const refresh = () => {
    setPending(true);
  };

  const retry = () => {
    setFailRefresh(false);
    setPending(true);
  };

  const demoSelection = [
    ...(demoEmpty ? [DEMO_OPTION_EMPTY] : []),
    ...(failRefresh ? [DEMO_OPTION_FAILURE] : []),
  ];

  return (
    <Page>
      <PageHeader
        description={t('analytics.description')}
        eyebrow={t('analytics.eyebrow')}
        title={t('analytics.title')}
      />

      <AlertBanner
        description={t('analytics.demo.description')}
        icon={<Info className="size-icon-sm" />}
        title={t('analytics.demo.title')}
        tone="info"
      />

      <Toolbar
        label={t('analytics.toolbar.label')}
        primary={
          <ToggleGroup
            label={t('analytics.range.label')}
            onSelectionChange={(selected) => {
              const next = Number(selected[0]);
              if (isAnalyticsRange(next)) setRange(next);
            }}
            options={ANALYTICS_RANGES.map((option) => ({
              id: String(option),
              label: t(`analytics.range.${option}`),
            }))}
            selectedIds={[String(range)]}
            size="sm"
          />
        }
        secondary={
          <>
            <ToggleGroup
              label={t('analytics.demo.controls')}
              onSelectionChange={(selected) => {
                setDemoEmpty(selected.includes(DEMO_OPTION_EMPTY));
                setFailRefresh(selected.includes(DEMO_OPTION_FAILURE));
              }}
              options={[
                { id: DEMO_OPTION_EMPTY, label: t('analytics.demo.empty') },
                { id: DEMO_OPTION_FAILURE, label: t('analytics.demo.failure') },
              ]}
              selectedIds={demoSelection}
              selectionMode="multiple"
              size="sm"
            />
            <Action
              leadingIcon={<RefreshCw aria-hidden="true" className="size-icon-sm" />}
              loading={phase === 'refreshing'}
              onPress={refresh}
              size="sm"
              variant="secondary"
            >
              {t('analytics.refresh')}
            </Action>
          </>
        }
      />

      <AsyncRegion
        empty={
          <StateSurface
            actionLabel={t('analytics.empty.action')}
            description={t('analytics.empty.description')}
            icon={<Inbox className="size-icon" />}
            onAction={() => setDemoEmpty(false)}
            state="empty"
            title={t('analytics.empty.title')}
          />
        }
        error={
          <StateSurface
            actionLabel={t('analytics.error.action')}
            announcement="urgent"
            description={t('analytics.error.description')}
            icon={<TriangleAlert className="size-icon" />}
            onAction={retry}
            state="error"
            title={t('analytics.error.title')}
          />
        }
        label={t('analytics.async.label')}
        loading={<AnalyticsLoading />}
        phase={phase}
        refreshing={
          <p aria-live="polite" className="text-sm text-ink-muted" role="status">
            {t('analytics.async.refreshing')}
          </p>
        }
      >
        <div className="grid gap-4">
          <AnalyticsKpiGrid kpis={dataset.kpis} />
          <AnalyticsTrend dataset={dataset} />
          <AnalyticsBreakdowns dataset={dataset} />
          <p className="text-xs text-ink-muted">
            {t('analytics.footer', {
              days: formatNumber(locale, dataset.window.dayCount),
            })}
          </p>
        </div>
      </AsyncRegion>
    </Page>
  );
}

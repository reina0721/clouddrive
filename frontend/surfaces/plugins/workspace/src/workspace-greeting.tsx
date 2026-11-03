'use client';

import {
  formatDate,
  formatNumber,
  formatTimeOfDay,
  useFrontendTranslation,
} from '@clouddrive/i18n';
import { useIdentityPort } from '@clouddrive/surface/identity/runtime';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { CalendarDays, Clock3, FolderKanban, ListChecks, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  resolveGreetingPeriod,
  WORKSPACE_PROJECTS,
  WORKSPACE_TEAM_COUNT,
  WORKSPACE_TODO_IDS,
} from './workspace-data';

/**
 * 问候卡片：时段问候 + 当前日期/时刻 + 三项统计。
 *
 * - 用户名来自 `useIdentityPort().me()`（插件不 import `apps/web`）；`me()` 失败或尚未
 *   返回时使用 i18n 的安全兜底称呼，不阻塞页面；
 * - 当前时间只在挂载后读取（`now === null` 的首帧使用中性问候），避免 Next 预渲染与
 *   hydration 不一致，也避免静态导出把问候语固化在构建时刻。
 */
export function WorkspaceGreeting({ doneTodos }: Readonly<{ doneTodos: number }>) {
  const { t, locale } = useFrontendTranslation();
  const identity = useIdentityPort();
  const [now, setNow] = useState<Date | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    // 首帧保持中性问候（与预渲染一致），下一轮任务再读本机时间，避免 hydration 不一致。
    const timer = window.setTimeout(() => {
      setNow(new Date());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void identity
      .me()
      .then((user) => {
        if (!cancelled) setProfileName(user.name);
      })
      .catch(() => {
        if (!cancelled) setProfileName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [identity]);

  const displayName = profileName ?? t('workspace.greeting.fallbackName');
  const greeting = now
    ? t(`workspace.greeting.${resolveGreetingPeriod(now.getHours())}`, { name: displayName })
    : t('workspace.greeting.pending', { name: displayName });
  const timeZoneOptions = { timeZone: 'auto', hourCycle: 'h24', showSeconds: false } as const;

  const stats = [
    {
      id: 'todos',
      icon: ListChecks,
      label: t('workspace.stats.todosLabel'),
      value: t('workspace.stats.todosValue', {
        done: formatNumber(locale, doneTodos),
        total: formatNumber(locale, WORKSPACE_TODO_IDS.length),
      }),
    },
    {
      id: 'projects',
      icon: FolderKanban,
      label: t('workspace.stats.projectsLabel'),
      value: t('workspace.stats.projectsValue', {
        count: formatNumber(locale, WORKSPACE_PROJECTS.length),
      }),
    },
    {
      id: 'teams',
      icon: UsersRound,
      label: t('workspace.stats.teamsLabel'),
      value: t('workspace.stats.teamsValue', { count: formatNumber(locale, WORKSPACE_TEAM_COUNT) }),
    },
  ] as const;

  return (
    <Panel appearance="outlined" className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand">
            <CalendarDays aria-hidden="true" className="size-icon-sm" />
            {now ? formatDate(locale, now, { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
          </p>
          <h2 className="mt-3 text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {greeting}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {t('workspace.greeting.subtitle')}
          </p>
        </div>
        {now ? (
          <p className="inline-flex items-center gap-2 rounded-control border border-border bg-surface-muted px-3 py-1.5 text-xs font-semibold tabular-nums text-ink-muted">
            <Clock3 aria-hidden="true" className="size-icon-sm" />
            {formatTimeOfDay(locale, timeZoneOptions, now)}
          </p>
        ) : null}
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              className="flex items-center gap-3 rounded-panel border border-border bg-surface-muted/60 p-4"
              key={stat.id}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-control bg-surface text-brand">
                <Icon aria-hidden="true" className="size-icon" />
              </span>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {stat.label}
                </dt>
                <dd className="mt-1 text-lg font-bold tabular-nums text-ink">{stat.value}</dd>
              </div>
            </div>
          );
        })}
      </dl>
    </Panel>
  );
}

'use client';

import {
  formatDate,
  formatNumber,
  formatRelativeTime,
  useFrontendTranslation,
} from '@clouddrive/i18n';
import { route, RouteLink } from '@clouddrive/plugin-framework/plugin';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { createHydrationLifecycle, rehydrateStore } from '@clouddrive/state-foundation';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField } from '@clouddrive/ui-adapter/form-field';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { ProgressMeter } from '@clouddrive/ui-adapter/progress-meter';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import {
  ArrowRight,
  ChartLine,
  Info,
  LayoutDashboard,
  ListChecks,
  RotateCcw,
  ScrollText,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import type { ComponentType, SVGProps } from 'react';

import { useWorkspaceTodoStore } from '../stores/todo-store';
import { WorkspaceGreeting } from './workspace-greeting';
import {
  WORKSPACE_ACTIVITIES,
  WORKSPACE_PROJECTS,
  WORKSPACE_QUICK_LINKS,
  WORKSPACE_TODO_IDS,
  WORKSPACE_TODO_PRIORITIES,
  resolveRelativeTime,
  type WorkspaceQuickLinkId,
} from './workspace-data';

const QUICK_LINK_ICONS: Readonly<
  Record<WorkspaceQuickLinkId, ComponentType<SVGProps<SVGSVGElement>>>
> = {
  users: Users,
  roles: ShieldCheck,
  audit: ScrollText,
  settings: Settings2,
  analytics: ChartLine,
  workspace: LayoutDashboard,
};

const GROUP_TONES = {
  product: 'success',
  design: 'info',
  operations: 'warning',
  research: 'neutral',
} as const;

/**
 * 工作台页（VP-06）。
 *
 * Vben workspace 的信息架构（问候 + 快捷入口 + 项目 + 动态 + 待办），使用本项目
 * 自己的视觉语言：Page/PageHeader/Section、语义 token、i18n、StateSurface/Feedback。
 *
 * 明确边界：
 * - 用户名经 `useIdentityPort()`（Surface identity runtime）取得，不 import `apps/web`；
 * - 快捷入口用 symbolic `route()` + `RouteLink`，不写 raw href；
 * - 待办完成状态持久化在插件 store（`clouddrive.plugin.workspace` v1），
 *   完成数量实时反映到问候卡片统计；
 * - 页面内容全部是演示数据（与 analytics 相同的诚实性要求）。
 */
export function WorkspacePage() {
  const { t, locale } = useFrontendTranslation();
  const completedIds = useWorkspaceTodoStore((state) => state.completedIds);
  const warning = useWorkspaceTodoStore((state) => state.warning);
  const toggleTodo = useWorkspaceTodoStore((state) => state.toggleTodo);
  const resetTodos = useWorkspaceTodoStore((state) => state.resetTodos);

  // storage 读取失败（非法 JSON / 不可用）不写回原记录，经 hydration lifecycle 暴露。
  const todoLifecycle = createHydrationLifecycle(useWorkspaceTodoStore);
  const hydrationStatus = useSyncExternalStore(
    (onChange) => todoLifecycle.subscribe(() => onChange()),
    () => todoLifecycle.status,
    () => 'idle' as const,
  );

  useEffect(() => {
    rehydrateStore(useWorkspaceTodoStore);
  }, []);

  const completedSet = new Set(completedIds);
  const totalTodos = WORKSPACE_TODO_IDS.length;
  const doneTodos = WORKSPACE_TODO_IDS.filter((id) => completedSet.has(id)).length;
  const allDone = doneTodos === totalTodos;
  const warningKey = warning ?? (hydrationStatus === 'error' ? 'storage-error' : null);

  return (
    <Page>
      <PageHeader
        description={t('workspace.description')}
        eyebrow={t('workspace.eyebrow')}
        title={t('workspace.title')}
      />

      <AlertBanner
        description={t('workspace.demo.description')}
        icon={<Info className="size-icon-sm" />}
        title={t('workspace.demo.title')}
        tone="info"
      />

      <WorkspaceGreeting doneTodos={doneTodos} />

      <Section
        contentInset
        description={t('workspace.quickNav.description')}
        title={t('workspace.quickNav.title')}
      >
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-reveal-items>
          {WORKSPACE_QUICK_LINKS.map((link) => {
            const Icon = QUICK_LINK_ICONS[link.id];
            return (
              <li className="min-w-0" key={link.id}>
                <RouteLink
                  ariaLabel={t(`workspace.quickNav.${link.id}`)}
                  className="flex h-full min-w-0 items-start gap-3 rounded-panel bg-surface-muted/60 p-4 outline-none transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  target={route(link.routeId)}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-control bg-surface text-brand"
                  >
                    <Icon className="size-icon" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">
                      {t(`workspace.quickNav.${link.id}`)}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-ink-muted">
                      {t(`workspace.quickNav.${link.id}Description`)}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="mt-1 size-icon-sm shrink-0 text-ink-muted"
                  />
                </RouteLink>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        contentInset
        description={t('workspace.projects.description')}
        title={t('workspace.projects.title')}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-reveal-items>
          {WORKSPACE_PROJECTS.map((project) => (
            <article
              className="flex min-w-0 flex-col gap-3 rounded-panel bg-surface-muted/60 p-5"
              key={project.id}
            >
              <h3 className="text-sm font-bold text-ink">
                {t(`workspace.projects.${project.id}.name`)}
              </h3>
              <p className="min-h-12 text-xs leading-6 text-ink-muted">
                {t(`workspace.projects.${project.id}.quote`)}
              </p>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                <StatusPill tone={GROUP_TONES[project.group]}>
                  {t(`workspace.projects.group.${project.group}`)}
                </StatusPill>
                <span className="inline-flex items-center gap-2 tabular-nums">
                  {formatDate(locale, project.updatedAt, {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}
                  <span aria-hidden="true">·</span>
                  {t('workspace.projects.members', {
                    count: formatNumber(locale, project.members),
                  })}
                </span>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          contentInset
          description={t('workspace.activities.description')}
          title={t('workspace.activities.title')}
        >
          <ol className="divide-y divide-border">
            {WORKSPACE_ACTIVITIES.map((activity) => {
              const relative = resolveRelativeTime(activity.minutesAgo);
              return (
                <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0" key={activity.id}>
                  <span
                    aria-hidden="true"
                    className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand"
                  >
                    {t(`workspace.people.${activity.actorId}`).slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-6 text-ink">
                      <span className="font-semibold">
                        {t(`workspace.people.${activity.actorId}`)}
                      </span>{' '}
                      <span className="text-ink-muted">
                        {t(`workspace.activities.item.${activity.id}`)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {formatRelativeTime(locale, relative.value, relative.unit)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>

        <Section
          action={
            <Action
              leadingIcon={<RotateCcw aria-hidden="true" className="size-icon-sm" />}
              onPress={resetTodos}
              size="sm"
              variant="quiet"
            >
              {t('workspace.todos.reset')}
            </Action>
          }
          contentInset
          description={t('workspace.todos.description')}
          title={t('workspace.todos.title')}
        >
          <div className="grid gap-4">
            {warningKey ? (
              <AlertBanner
                description={t(`workspace.todos.warning.${warningKey}`)}
                icon={<TriangleAlert className="size-icon-sm" />}
                title={t('workspace.todos.warning.title')}
                tone="warning"
              />
            ) : null}

            <ProgressMeter
              label={t('workspace.todos.progress')}
              value={(doneTodos / totalTodos) * 100}
            />

            {allDone ? (
              <StateSurface
                actionLabel={t('workspace.todos.empty.action')}
                description={t('workspace.todos.empty.description')}
                icon={<ListChecks className="size-icon" />}
                onAction={resetTodos}
                state="empty"
                title={t('workspace.todos.empty.title')}
              />
            ) : (
              <ul className="divide-y divide-border">
                {WORKSPACE_TODO_IDS.map((id) => (
                  <li className="py-3 first:pt-0 last:pb-0" key={id}>
                    <CheckboxField
                      checked={completedSet.has(id)}
                      description={t(`workspace.todos.priority.${WORKSPACE_TODO_PRIORITIES[id]}`)}
                      label={t(`workspace.todos.item.${id}`)}
                      onCheckedChange={() => toggleTodo(id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      </div>
    </Page>
  );
}

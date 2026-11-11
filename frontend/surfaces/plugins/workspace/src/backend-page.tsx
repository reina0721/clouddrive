'use client';
import { useCallback, useState } from 'react';
import { useFrontendTranslation, formatNumber } from '@clouddrive/i18n';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { useShellNavigationView } from '../../../src/shell-navigation-view';
import { NavigationIcon } from '../../../src/navigation-icon-presentation';
import type { NavigationIconId } from '../../../src/navigation-icon';
import { useProductAccess } from '../../../src/identity/runtime';
import { Action } from '@clouddrive/ui-adapter/action';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { DataTable, type DataColumn } from '@clouddrive/ui-adapter/data-display';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { useRequiredAdministration } from '../../../src/administration/context';
import { useRemote, RemoteRegion } from '../../../src/administration/resource-state';
import type { Todo } from '../../../src/administration/model';
import Link from 'next/link';
import { managementTaskGroups, visibleNavigationEntries } from './management-tasks';

function TodoAction({ todo, onSaved }: Readonly<{ todo?: Todo; onSaved: () => void }>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const [title, setTitle] = useState('');
  const [failure, setFailure] = useState<string>();
  return (
    <DialogSurface
      triggerLabel={t(todo ? 'administration.complete' : 'workspace.management.addTodo')}
      title={t(todo ? 'workspace.management.completeTodo' : 'workspace.management.addTodo')}
      description={t(
        todo ? 'workspace.management.completeTodoHint' : 'workspace.management.addTodoHint',
      )}
      cancelLabel={t('administration.cancel')}
      confirmLabel={t('administration.confirm')}
      confirmDisabled={!todo && !title.trim()}
      {...(failure ? { failureMessage: failure } : {})}
      onConfirm={async () => {
        try {
          if (todo) await port.completeTodo(todo.id);
          else await port.createTodo(title.trim());
          setFailure(undefined);
          setTitle('');
          onSaved();
        } catch (error) {
          setFailure(t('administration.failureDescription'));
          throw error;
        }
      }}
    >
      {todo ? (
        <p>{todo.title}</p>
      ) : (
        <TextField
          label={t('administration.title')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      )}
    </DialogSurface>
  );
}
function TodoPanel({ canWrite }: { canWrite: boolean }) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const todos = useRemote(useCallback(() => port.todos(), [port]));
  const columns: readonly DataColumn<Todo>[] = [
    {
      id: 'title',
      label: t('administration.title'),
      rowHeader: true,
      render: (todo) => todo.title,
    },
    {
      id: 'status',
      label: t('administration.status'),
      render: (todo) => (
        <StatusPill tone={todo.status === 'completed' ? 'success' : 'neutral'}>
          {t('workspace.management.todoStatus.' + todo.status)}
        </StatusPill>
      ),
    },
    ...(canWrite
      ? [
          {
            id: 'actions',
            label: t('administration.actions'),
            render: (todo: Todo) =>
              todo.status === 'pending' ? <TodoAction todo={todo} onSaved={todos.reload} /> : null,
          },
        ]
      : []),
  ];
  return (
    <Section
      title={t('administration.todos')}
      contentInset
      description={t('workspace.management.todosHint')}
    >
      {canWrite ? <TodoAction onSaved={todos.reload} /> : null}
      <RemoteRegion {...todos}>
        <DataTable
          label={t('administration.todos')}
          columns={columns}
          rows={todos.value ?? []}
          emptyContent={t('workspace.management.noTodos')}
        />
      </RemoteRegion>
    </Section>
  );
}

export function BackendWorkspacePage() {
  const port = useRequiredAdministration();
  const { t, locale } = useFrontendTranslation();
  const access = useProductAccess();
  const view = useShellNavigationView();
  const [revision, setRevision] = useState(0);
  const dashboard = useRemote(useCallback(() => port.dashboard(), [port]));
  const groups = managementTaskGroups(view.groups);
  const files = visibleNavigationEntries(view.groups).find((entry) => entry.id === 'files.root');
  const native = access.data?.nativePermissions ?? [];
  const canReadTodos = native.includes('todos:read');
  const canWriteTodos = native.includes('todos:write');
  const showCounts =
    dashboard.error ||
    dashboard.loading ||
    dashboard.value?.users !== null ||
    dashboard.value?.roles !== null;
  return (
    <Page>
      <PageHeader
        title={t('workspace.management.title')}
        description={t('workspace.management.description')}
        actions={
          <>
            {files ? (
              <Link
                href={files.href}
                className="ui-navigation-focus inline-flex min-h-control items-center rounded-action px-4 text-sm font-medium text-brand hover:bg-brand-soft"
              >
                {t('workspace.management.backToFiles')}
              </Link>
            ) : null}
            <Action
              variant="quiet"
              onPress={() => {
                dashboard.reload();
                view.onReload();
                access.reload();
                setRevision((value) => value + 1);
              }}
            >
              {t('administration.refresh')}
            </Action>
          </>
        }
      />
      {view.status === 'loading' ? (
        <p role="status">{t('workspace.management.loading')}</p>
      ) : view.status === 'error' ? (
        <StateSurface
          state="error"
          icon={<NavigationIcon iconId="identity" />}
          title={t('workspace.management.navigationFailure')}
          description={t('workspace.management.navigationFailureHint')}
          announcement="urgent"
          actionLabel={t('administration.retry')}
          onAction={view.onReload}
        />
      ) : groups.length ? (
        groups.map((group) => (
          <Section key={group.id} title={t('workspace.management.groups.' + group.id)} contentInset>
            <ul className="grid gap-3 md:grid-cols-2" data-reveal-items>
              {group.items.map((entry) => (
                <li className="min-w-0" key={entry.id}>
                  <Link
                    href={entry.href}
                    className="ui-navigation-focus flex h-full min-w-0 items-start gap-3 rounded-control bg-surface-muted/60 px-4 py-4 hover:bg-brand-soft"
                  >
                    <span className="mt-0.5 shrink-0 text-brand" aria-hidden="true">
                      <NavigationIcon
                        iconId={(entry.iconId ?? 'resource') as NavigationIconId}
                        size="size-5"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-semibold">
                        {view.labels[entry.labelKey] ?? t(entry.labelKey)}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-ink-muted">
                        {t('workspace.management.tasks.' + entry.hint)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ))
      ) : (
        <StateSurface
          state="empty"
          icon={<NavigationIcon iconId="identity" />}
          title={t('workspace.management.noAccessTitle')}
          description={t('workspace.management.noAccessHint')}
        />
      )}
      {showCounts ? (
        <Section title={t('workspace.management.countsTitle')} contentInset>
          <RemoteRegion {...dashboard}>
            <DescriptionList
              label={t('workspace.management.countsTitle')}
              columns={2}
              items={[
                ...(dashboard.value?.users !== null && dashboard.value?.users !== undefined
                  ? [
                      {
                        id: 'users',
                        term: t('administration.users'),
                        description: formatNumber(locale, dashboard.value.users),
                      },
                    ]
                  : []),
                ...(dashboard.value?.roles !== null && dashboard.value?.roles !== undefined
                  ? [
                      {
                        id: 'roles',
                        term: t('administration.roles'),
                        description: formatNumber(locale, dashboard.value.roles),
                      },
                    ]
                  : []),
              ]}
            />
          </RemoteRegion>
        </Section>
      ) : null}
      {canReadTodos ? <TodoPanel key={revision} canWrite={canWriteTodos} /> : null}
    </Page>
  );
}

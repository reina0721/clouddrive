'use client';
import { useCallback, useState } from 'react';
import { DashboardSummary } from '../../../src/administration/dashboard-summary';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, Section, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { DataTable, type DataColumn } from '@clouddrive/ui-adapter/data-display';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useRequiredAdministration } from '../../../src/administration/context';
import { useRemote, RemoteRegion } from '../../../src/administration/resource-state';
import type { Todo } from '../../../src/administration/model';

function TodoAction({ todo, onSaved }: Readonly<{ todo?: Todo; onSaved: () => void }>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const [title, setTitle] = useState('');
  const [failure, setFailure] = useState<string>();
  return (
    <DialogSurface
      triggerLabel={t(todo ? 'administration.complete' : 'administration.create')}
      title={t('administration.todos')}
      description={todo?.title ?? t('administration.description')}
      cancelLabel={t('administration.cancel')}
      confirmLabel={t('administration.confirm')}
      {...(failure ? { failureMessage: failure } : {})}
      onConfirm={async () => {
        try {
          if (todo) await port.completeTodo(todo.id);
          else await port.createTodo(title);
          setFailure(undefined);
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
export function BackendWorkspacePage() {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const dashboard = useRemote(useCallback(() => port.dashboard(), [port]));
  const todos = useRemote(useCallback(() => port.todos(), [port]));
  const columns: readonly DataColumn<Todo>[] = [
    {
      id: 'title',
      label: t('administration.title'),
      rowHeader: true,
      render: (todo) => todo.title,
    },
    { id: 'status', label: t('administration.status'), render: (todo) => todo.status },
    {
      id: 'actions',
      label: t('administration.actions'),
      render: (todo) =>
        todo.status === 'pending' ? <TodoAction todo={todo} onSaved={todos.reload} /> : null,
    },
  ];
  return (
    <Page>
      <PageHeader
        title={t('administration.workspace')}
        description={t('administration.description')}
      />
      <Toolbar
        label={t('administration.actions')}
        primary={
          <Action
            onPress={() => {
              dashboard.reload();
              todos.reload();
            }}
          >
            {t('administration.refresh')}
          </Action>
        }
      />
      <RemoteRegion {...dashboard}>
        <DashboardSummary value={dashboard.value} />
      </RemoteRegion>
      <Section title={t('administration.todos')}>
        <TodoAction onSaved={todos.reload} />
        <RemoteRegion {...todos}>
          <DataTable
            label={t('administration.todos')}
            columns={columns}
            rows={todos.value ?? []}
            emptyContent={t('administration.empty')}
          />
        </RemoteRegion>
      </Section>
    </Page>
  );
}

'use client';

import { formatDate, formatNumber, useFrontendTranslation } from '@clouddrive/i18n';
import { ChevronDown, ChevronRight, RotateCcw, Trash2 } from '@clouddrive/surface/action-icons';
import { NavigationIcon } from '@clouddrive/surface/icon-presentation';
import { useProductAccess } from '@clouddrive/surface/identity/runtime';
import { Collection } from '@clouddrive/surface-foundation/collection';
import { Page, PageHeader, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { AsyncRegion } from '@clouddrive/ui-adapter/async-region';
import { DataTable, type DataColumn } from '@clouddrive/ui-adapter/data-display';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { Skeleton } from '@clouddrive/ui-adapter/skeleton';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { useEffect, useMemo, useState } from 'react';

import { useDepartmentsStore } from '../stores/departments';
import { DepartmentDialog } from './department-dialog';
import {
  buildDepartmentRows,
  departmentDeleteBlocker,
  selectVisibleDepartmentRows,
  type DepartmentTreeRow,
} from './department-model';
import { useDepartmentsHydration } from './use-departments-hydration';

const indentClass = ['', 'pl-6', 'pl-12'] as const;

const issueMessageKey = (reason: string): string => {
  switch (reason) {
    case 'has-children':
      return 'departments.deleteBlocked.children';
    case 'has-members':
      return 'departments.deleteBlocked.members';
    case 'name-length':
      return 'departments.validation.name';
    case 'leader-length':
      return 'departments.validation.leader';
    case 'remark-length':
      return 'departments.validation.remark';
    case 'parent-depth':
      return 'departments.validation.parentDepth';
    case 'parent-invalid':
      return 'departments.validation.parent';
    default:
      return 'departments.dialog.failure';
  }
};

function DepartmentNameCell({
  row,
  expanded,
  onToggle,
}: Readonly<{ row: DepartmentTreeRow; expanded: boolean; onToggle: () => void }>) {
  const { t } = useFrontendTranslation();
  const indent = indentClass[row.depth] ?? '';
  return (
    <div className={`flex min-w-0 items-center gap-2 ${indent}`}>
      {row.childCount > 0 ? (
        <IconAction
          label={t(expanded ? 'departments.expansion.collapse' : 'departments.expansion.expand', {
            name: row.name,
          })}
          size="sm"
          expanded={expanded}
          onPress={onToggle}
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </IconAction>
      ) : (
        <span aria-hidden="true" className="inline-block size-control-sm shrink-0" />
      )}
      <span className="min-w-0 break-words font-semibold text-ink">{row.name}</span>
    </div>
  );
}

export function DepartmentsPage() {
  const { t, locale } = useFrontendTranslation();
  const { notify } = useFeedback();
  const access = useProductAccess();
  const allowed = access.data?.permissions.includes('settings.update') ?? false;
  const accessSettled = access.data !== null;
  const { status: hydration, recover } = useDepartmentsHydration();
  const nodes = useDepartmentsStore((state) => state.nodes);
  const setWritable = useDepartmentsStore((state) => state.setWritable);
  const remove = useDepartmentsStore((state) => state.remove);
  const resetDemo = useDepartmentsStore((state) => state.resetDemo);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingDelete, setPendingDelete] = useState<DepartmentTreeRow | null>(null);
  const [deleteFailure, setDeleteFailure] = useState<string | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreFailure, setRestoreFailure] = useState<string | null>(null);

  useEffect(() => {
    setWritable(allowed);
  }, [allowed, setWritable]);

  const rows = useMemo(() => buildDepartmentRows(nodes), [nodes]);
  const visible = useMemo(
    () => selectVisibleDepartmentRows(rows, { query, collapsedIds: collapsed }),
    [collapsed, query, rows],
  );

  const toggleCollapsed = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columns: readonly DataColumn<DepartmentTreeRow>[] = [
    {
      id: 'name',
      label: t('departments.columns.name'),
      rowHeader: true,
      render: (row) => (
        <DepartmentNameCell
          row={row}
          expanded={!collapsed.has(row.id)}
          onToggle={() => toggleCollapsed(row.id)}
        />
      ),
    },
    {
      id: 'leader',
      label: t('departments.columns.leader'),
      render: (row) => row.leader,
    },
    {
      id: 'members',
      label: t('departments.columns.members'),
      render: (row) => (
        <span className="tabular-nums">{formatNumber(locale, row.memberCount)}</span>
      ),
    },
    {
      id: 'status',
      label: t('departments.columns.status'),
      render: (row) => (
        <StatusPill tone={row.status === 'active' ? 'success' : 'neutral'}>
          {t(`departments.status.${row.status}`)}
        </StatusPill>
      ),
    },
    {
      id: 'remark',
      label: t('departments.columns.remark'),
      render: (row) => (
        <span className="block max-w-64 truncate text-ink-muted" title={row.remark}>
          {row.remark}
        </span>
      ),
    },
    {
      id: 'createdAt',
      label: t('departments.columns.createdAt'),
      render: (row) => (
        <span className="whitespace-nowrap text-ink-muted">
          {formatDate(locale, row.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      label: t('departments.columns.actions'),
      render: (row) => {
        const blocker = departmentDeleteBlocker(nodes, row.id);
        const depthLimited = row.depth >= 2;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {!allowed ? (
              <Action size="sm" variant="quiet" disabled>
                {t('departments.actions.addChild')}
              </Action>
            ) : depthLimited ? (
              <Action size="sm" variant="quiet" disabled>
                {t('departments.actions.addChild')}
              </Action>
            ) : (
              <DepartmentDialog
                key={`create:${row.id}`}
                mode="create"
                triggerLabel={t('departments.actions.addChild')}
                nodes={nodes}
                parentId={row.id}
              />
            )}
            {allowed ? (
              <DepartmentDialog
                key={`edit:${row.id}:${row.version}`}
                mode="edit"
                triggerLabel={t('departments.actions.edit')}
                nodes={nodes}
                node={row}
              />
            ) : (
              <Action size="sm" variant="quiet" disabled>
                {t('departments.actions.edit')}
              </Action>
            )}
            <IconAction
              label={t('departments.actions.delete')}
              tooltip={
                blocker === 'has-children'
                  ? t('departments.deleteBlocked.children')
                  : blocker === 'has-members'
                    ? t('departments.deleteBlocked.members', {
                        count: row.memberCount,
                      })
                    : true
              }
              size="sm"
              tone="danger"
              disabled={!allowed || blocker !== null}
              onPress={() => {
                setDeleteFailure(null);
                setPendingDelete(row);
              }}
            >
              <Trash2 className="size-3.5" />
            </IconAction>
          </div>
        );
      },
    },
  ];

  const phase = hydration === 'error' ? 'error' : hydration === 'hydrated' ? 'ready' : 'initial';

  return (
    <Page>
      <PageHeader
        eyebrow={t('departments.eyebrow')}
        title={t('departments.title')}
        description={t('departments.description')}
        actions={
          accessSettled ? undefined : (
            <StatusPill tone="neutral">{t('departments.permissionPending')}</StatusPill>
          )
        }
      />
      {accessSettled && !allowed ? (
        <AlertBanner
          tone="warning"
          icon={<NavigationIcon iconId="identity" />}
          title={t('departments.readonlyTitle')}
          description={t('departments.readonlyDescription')}
          announcement="polite"
        />
      ) : null}
      <AsyncRegion
        phase={phase}
        label={t('departments.collection')}
        loading={
          <div className="grid gap-2.5 p-5" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-control w-full" />
            ))}
          </div>
        }
        refreshing={null}
        error={
          <StateSurface
            state="warning"
            icon={<NavigationIcon iconId="identity" />}
            title={t('departments.hydration.title')}
            description={t('departments.hydration.description')}
            actionLabel={t('departments.hydration.reset')}
            onAction={recover}
            announcement="polite"
          />
        }
        empty={null}
      >
        <div className="grid gap-4">
          <Toolbar
            label={t('departments.toolbar.label')}
            primary={
              <div className="min-w-64 flex-1">
                <SearchBox
                  label={t('departments.toolbar.search')}
                  placeholder={t('departments.toolbar.searchPlaceholder')}
                  value={query}
                  onValueChange={setQuery}
                />
              </div>
            }
            secondary={
              <>
                <Action
                  variant="quiet"
                  size="sm"
                  leadingIcon={<RotateCcw className="size-3.5" />}
                  disabled={!allowed}
                  onPress={() => {
                    setRestoreFailure(null);
                    setRestoreOpen(true);
                  }}
                >
                  {t('departments.toolbar.reset')}
                </Action>
                {allowed ? (
                  <DepartmentDialog
                    mode="create"
                    triggerLabel={t('departments.toolbar.create')}
                    nodes={nodes}
                  />
                ) : (
                  <Action disabled>{t('departments.toolbar.create')}</Action>
                )}
              </>
            }
          />
          <Collection
            title={t('departments.collection')}
            description={t('departments.collectionDescription')}
            count={formatNumber(locale, rows.length)}
            content={
              <DataTable
                label={t('departments.collection')}
                columns={columns}
                rows={visible}
                density="comfortable"
                emptyContent={
                  <p className="text-sm text-ink-muted">
                    {query.trim().length > 0
                      ? t('departments.empty.search')
                      : t('departments.empty.none')}
                  </p>
                }
              />
            }
          />
        </div>
      </AsyncRegion>
      <ConfirmDialog
        triggerLabel=""
        title={t('departments.delete.title')}
        description={t('departments.delete.description', {
          name: pendingDelete?.name ?? '',
        })}
        impact={t('departments.delete.impact')}
        cancelLabel={t('departments.delete.cancel')}
        confirmLabel={t('departments.delete.confirm')}
        failureMessage={deleteFailure ?? t('departments.delete.failure')}
        tone="danger"
        confirmDisabled={!allowed}
        isOpen={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setDeleteFailure(null);
          }
        }}
        onConfirm={() => {
          if (pendingDelete === null) return;
          const result = remove(pendingDelete.id, pendingDelete.version);
          if (!result.ok) {
            setDeleteFailure(
              result.code === 'conflict'
                ? t('departments.conflict')
                : result.code === 'invalid'
                  ? t(issueMessageKey(result.reason))
                  : t('departments.readonlyDescription'),
            );
            throw new Error(`departments: delete ${result.code}`);
          }
          setPendingDelete(null);
          notify({ title: t('departments.deleteSuccess'), tone: 'success' });
        }}
      />
      <ConfirmDialog
        triggerLabel=""
        title={t('departments.restore.title')}
        description={t('departments.restore.description')}
        impact={t('departments.restore.impact')}
        cancelLabel={t('departments.restore.cancel')}
        confirmLabel={t('departments.restore.confirm')}
        failureMessage={restoreFailure ?? t('departments.restore.failure')}
        confirmDisabled={!allowed}
        isOpen={restoreOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRestoreOpen(false);
            setRestoreFailure(null);
          }
        }}
        onConfirm={() => {
          const result = resetDemo();
          if (!result.ok) {
            setRestoreFailure(t('departments.restore.failure'));
            throw new Error(`departments: restore ${result.code}`);
          }
          setRestoreOpen(false);
          notify({ title: t('departments.restoreSuccess'), tone: 'success' });
        }}
      />
    </Page>
  );
}

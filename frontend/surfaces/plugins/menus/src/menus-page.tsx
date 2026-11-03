'use client';

import { formatDate, formatNumber, useFrontendTranslation } from '@clouddrive/i18n';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  RotateCcw,
  Trash2,
} from '@clouddrive/surface/action-icons';
import { generatedRouteCatalog } from '@clouddrive/surface/generated/catalog';
import { NavigationIcon } from '@clouddrive/surface/icon-presentation';
import { useProductAccess } from '@clouddrive/surface/identity/runtime';
import { Collection } from '@clouddrive/surface-foundation/collection';
import { Page, PageHeader, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { AsyncRegion } from '@clouddrive/ui-adapter/async-region';
import { DataTable, type DataColumn } from '@clouddrive/ui-adapter/data-display';
import { AlertBanner, Badge } from '@clouddrive/ui-adapter/feedback';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { CheckboxField } from '@clouddrive/ui-adapter/form-field';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { Skeleton } from '@clouddrive/ui-adapter/skeleton';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { useEffect, useMemo, useState } from 'react';

import { useMenuOverlayStore, type MenuOverlayResult } from '../stores/menu-overrides';
import { buildMenuCatalogEntries, type MenuCatalogEntry } from './menu-catalog';
import { MenuEditDialog } from './menu-edit-dialog';
import { applyMenuOverlay, selectVisibleMenuEntries, type ResolvedMenuEntry } from './menu-overlay';
import { isKnownNavigationIconId } from './navigation-icon-guard';
import { useMenuOverlayHydration } from './use-menu-overlay-hydration';

type MenuRow = ResolvedMenuEntry<MenuCatalogEntry>;

const indentClass = ['', 'pl-6', 'pl-12'] as const;

const typeTone = { group: 'neutral', menu: 'info', submenu: 'neutral' } as const;

function MenuTitleCell({
  row,
  expandable,
  expanded,
  onToggle,
}: Readonly<{
  row: MenuRow;
  expandable: boolean;
  expanded: boolean;
  onToggle: () => void;
}>) {
  const { t } = useFrontendTranslation();
  const indentation = indentClass[row.depth] ?? '';
  return (
    <div className={`flex min-w-0 items-center gap-2 ${indentation}`}>
      {expandable ? (
        <IconAction
          label={t(expanded ? 'menus.expansion.collapse' : 'menus.expansion.expand', {
            label: row.label,
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
      {row.iconId !== undefined && isKnownNavigationIconId(row.iconId) ? (
        <NavigationIcon iconId={row.iconId} className="size-4 shrink-0 text-ink-muted" />
      ) : (
        <span aria-hidden="true" className="inline-block size-icon shrink-0" />
      )}
      <span className="min-w-0 break-words font-semibold text-ink">{row.label}</span>
      {row.overridden ? <Badge tone="info">{t('menus.modified')}</Badge> : null}
      {row.hidden ? <Badge tone="warning">{t('menus.hidden')}</Badge> : null}
    </div>
  );
}

function OrderStepper({
  order,
  disabled,
  onStep,
}: Readonly<{ order: number; disabled: boolean; onStep: (delta: 1 | -1) => void }>) {
  const { t } = useFrontendTranslation();
  return (
    <div className="flex items-center gap-1">
      <IconAction
        label={t('menus.actions.orderDown')}
        size="sm"
        disabled={disabled || order <= 0}
        onPress={() => onStep(-1)}
      >
        <ArrowDown className="size-3.5" />
      </IconAction>
      <span className="w-8 text-center text-sm tabular-nums text-ink">{order}</span>
      <IconAction
        label={t('menus.actions.orderUp')}
        size="sm"
        disabled={disabled || order >= 999}
        onPress={() => onStep(1)}
      >
        <ArrowUp className="size-3.5" />
      </IconAction>
    </div>
  );
}

export function MenusPage() {
  const { t, locale } = useFrontendTranslation();
  const { notify } = useFeedback();
  const access = useProductAccess();
  const allowed = access.data?.permissions.includes('settings.update') ?? false;
  const accessSettled = access.data !== null;
  const { status: hydration, recover } = useMenuOverlayHydration();
  const overrides = useMenuOverlayStore((state) => state.overrides);
  const updatedAt = useMenuOverlayStore((state) => state.updatedAt);
  const setWritable = useMenuOverlayStore((state) => state.setWritable);
  const update = useMenuOverlayStore((state) => state.update);
  const resetPresentation = useMenuOverlayStore((state) => state.resetPresentation);
  const clear = useMenuOverlayStore((state) => state.clear);
  const clearAll = useMenuOverlayStore((state) => state.clearAll);

  const [query, setQuery] = useState('');
  const [onlyModified, setOnlyModified] = useState(false);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingClear, setPendingClear] = useState<MenuRow | null>(null);
  const [clearFailure, setClearFailure] = useState<string | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreFailure, setRestoreFailure] = useState<string | null>(null);

  useEffect(() => {
    setWritable(allowed);
  }, [allowed, setWritable]);

  const baseEntries = useMemo(() => buildMenuCatalogEntries(generatedRouteCatalog, t), [t]);
  const resolved = useMemo(
    () => applyMenuOverlay(baseEntries, overrides),
    [baseEntries, overrides],
  );
  const parentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of baseEntries) {
      if (entry.parentId !== undefined) ids.add(entry.parentId);
    }
    return ids;
  }, [baseEntries]);
  const visible = useMemo(
    () => selectVisibleMenuEntries(resolved, { query, onlyModified, collapsedIds: collapsed }),
    [collapsed, onlyModified, query, resolved],
  );

  const report = (result: MenuOverlayResult, successKey: string) => {
    if (result.ok) {
      notify({ title: t(successKey), tone: 'success' });
      return;
    }
    notify({
      title:
        result.code === 'conflict'
          ? t('menus.conflict')
          : result.code === 'readonly'
            ? t('menus.readonlyDescription')
            : t('menus.dialog.failure'),
      tone: result.code === 'conflict' ? 'warning' : 'danger',
    });
  };

  const toggleCollapsed = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columns: readonly DataColumn<MenuRow>[] = [
    {
      id: 'title',
      label: t('menus.columns.title'),
      rowHeader: true,
      render: (row) => (
        <MenuTitleCell
          row={row}
          expandable={parentIds.has(row.id)}
          expanded={!collapsed.has(row.id)}
          onToggle={() => toggleCollapsed(row.id)}
        />
      ),
    },
    {
      id: 'kind',
      label: t('menus.columns.type'),
      render: (row) => <Badge tone={typeTone[row.kind]}>{t(`menus.type.${row.kind}`)}</Badge>,
    },
    {
      id: 'permission',
      label: t('menus.columns.permission'),
      render: (row) =>
        row.permission ? (
          <span className="font-mono text-xs text-ink-muted">{row.permission}</span>
        ) : (
          <span className="text-ink-muted">{t('menus.placeholder')}</span>
        ),
    },
    {
      id: 'path',
      label: t('menus.columns.path'),
      render: (row) =>
        row.pattern ? (
          <span className="font-mono text-xs text-ink-muted" title={row.routeId}>
            {row.pattern}
          </span>
        ) : (
          <span className="text-ink-muted">{t('menus.placeholder')}</span>
        ),
    },
    {
      id: 'order',
      label: t('menus.columns.order'),
      render: (row) => {
        const routeId = row.navigationId ?? row.routeId;
        if (routeId === undefined)
          return <span className="text-ink-muted">{t('menus.placeholder')}</span>;
        return (
          <OrderStepper
            order={row.order}
            disabled={!allowed}
            onStep={(delta) =>
              report(
                update(
                  routeId,
                  { order: Math.min(999, Math.max(0, row.order + delta)) },
                  row.version,
                ),
                'menus.saveSuccess',
              )
            }
          />
        );
      },
    },
    {
      id: 'actions',
      label: t('menus.columns.actions'),
      render: (row) => {
        const routeId = row.navigationId ?? row.routeId;
        if (routeId === undefined) {
          return <span className="text-xs text-ink-muted">{t('menus.structuralReadonly')}</span>;
        }
        const presentationOverridden =
          row.overridden && overrides[routeId] !== undefined
            ? overrides[routeId]?.label !== undefined ||
              overrides[routeId]?.order !== undefined ||
              overrides[routeId]?.permission !== undefined
            : false;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {allowed ? (
              <MenuEditDialog
                key={`${routeId}:${row.version}`}
                routeId={routeId}
                version={row.version}
                override={overrides[routeId]}
              />
            ) : (
              <Action size="sm" variant="quiet" disabled>
                {t('menus.actions.edit')}
              </Action>
            )}
            <IconAction
              label={t(row.hidden ? 'menus.actions.show' : 'menus.actions.hide')}
              tooltip
              size="sm"
              disabled={!allowed}
              onPress={() =>
                report(
                  update(routeId, { hidden: !row.hidden }, row.version),
                  row.hidden ? 'menus.showSuccess' : 'menus.hideSuccess',
                )
              }
            >
              {row.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            </IconAction>
            <IconAction
              label={t('menus.actions.reset')}
              tooltip
              size="sm"
              disabled={!allowed || !presentationOverridden}
              onPress={() => report(resetPresentation(routeId, row.version), 'menus.resetSuccess')}
            >
              <RotateCcw className="size-3.5" />
            </IconAction>
            <IconAction
              label={t('menus.actions.clear')}
              tooltip
              size="sm"
              tone="danger"
              disabled={!allowed || !row.overridden}
              onPress={() => {
                setClearFailure(null);
                setPendingClear(row);
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
        eyebrow={t('menus.eyebrow')}
        title={t('menus.title')}
        description={t('menus.description')}
        actions={
          accessSettled ? undefined : (
            <StatusPill tone="neutral">{t('menus.permissionPending')}</StatusPill>
          )
        }
      />
      {accessSettled && !allowed ? (
        <AlertBanner
          tone="warning"
          icon={<NavigationIcon iconId="settings" />}
          title={t('menus.readonlyTitle')}
          description={t('menus.readonlyDescription')}
          announcement="polite"
        />
      ) : null}
      <AsyncRegion
        phase={phase}
        label={t('menus.collection')}
        loading={
          <div className="grid gap-2.5 p-5" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <Skeleton key={index} className="h-control w-full" />
            ))}
          </div>
        }
        refreshing={null}
        error={
          <StateSurface
            state="warning"
            icon={<NavigationIcon iconId="settings" />}
            title={t('menus.hydration.title')}
            description={t('menus.hydration.description')}
            actionLabel={t('menus.hydration.reset')}
            onAction={recover}
            announcement="polite"
          />
        }
        empty={null}
      >
        <div className="grid gap-4">
          <Toolbar
            label={t('menus.toolbar.label')}
            primary={
              <>
                <div className="min-w-64 flex-1">
                  <SearchBox
                    label={t('menus.toolbar.search')}
                    placeholder={t('menus.toolbar.searchPlaceholder')}
                    value={query}
                    onValueChange={setQuery}
                  />
                </div>
                <div className="flex items-center">
                  <CheckboxField
                    label={t('menus.toolbar.onlyModified')}
                    checked={onlyModified}
                    onCheckedChange={setOnlyModified}
                  />
                </div>
              </>
            }
            secondary={
              <>
                <span className="text-xs text-ink-muted">
                  {updatedAt === null
                    ? t('menus.toolbar.savedNever')
                    : t('menus.toolbar.savedAt', {
                        time: formatDate(locale, updatedAt, {
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                      })}
                </span>
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
                  {t('menus.toolbar.restoreAll')}
                </Action>
              </>
            }
          />
          <Collection
            title={t('menus.collection')}
            description={t('menus.collectionDescription')}
            count={formatNumber(locale, visible.length)}
            content={
              <DataTable
                label={t('menus.collection')}
                columns={columns}
                rows={visible}
                density="compact"
                emptyContent={<p className="text-sm text-ink-muted">{t('menus.empty.search')}</p>}
              />
            }
          />
        </div>
      </AsyncRegion>
      <ConfirmDialog
        triggerLabel=""
        title={t('menus.delete.title')}
        description={t('menus.delete.description', { label: pendingClear?.label ?? '' })}
        impact={t('menus.delete.impact')}
        cancelLabel={t('menus.delete.cancel')}
        confirmLabel={t('menus.delete.confirm')}
        failureMessage={clearFailure ?? t('menus.delete.failure')}
        tone="danger"
        confirmDisabled={!allowed}
        isOpen={pendingClear !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingClear(null);
            setClearFailure(null);
          }
        }}
        onConfirm={() => {
          const routeId = pendingClear?.navigationId ?? pendingClear?.routeId;
          if (routeId === undefined || pendingClear === null) return;
          const result = clear(routeId, pendingClear.version);
          if (!result.ok) {
            setClearFailure(t('menus.delete.failure'));
            throw new Error(`menus: clear ${result.code}`);
          }
          setPendingClear(null);
          notify({ title: t('menus.clearSuccess'), tone: 'success' });
        }}
      />
      <ConfirmDialog
        triggerLabel=""
        title={t('menus.restore.title')}
        description={t('menus.restore.description')}
        impact={t('menus.restore.impact')}
        cancelLabel={t('menus.restore.cancel')}
        confirmLabel={t('menus.restore.confirm')}
        failureMessage={restoreFailure ?? t('menus.restore.failure')}
        confirmDisabled={!allowed}
        isOpen={restoreOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRestoreOpen(false);
            setRestoreFailure(null);
          }
        }}
        onConfirm={() => {
          const result = clearAll();
          if (!result.ok) {
            setRestoreFailure(t('menus.restore.failure'));
            throw new Error(`menus: clear-all ${result.code}`);
          }
          setRestoreOpen(false);
          notify({ title: t('menus.clearAllSuccess'), tone: 'success' });
        }}
      />
    </Page>
  );
}

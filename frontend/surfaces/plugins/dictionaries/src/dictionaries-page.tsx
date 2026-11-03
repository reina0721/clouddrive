'use client';

import { formatDate, formatNumber, useFrontendTranslation } from '@clouddrive/i18n';
import { Trash2 } from '@clouddrive/surface/action-icons';
import { NavigationIcon } from '@clouddrive/surface/icon-presentation';
import { useProductAccess } from '@clouddrive/surface/identity/runtime';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { AsyncRegion } from '@clouddrive/ui-adapter/async-region';
import { DataTable, type DataColumn } from '@clouddrive/ui-adapter/data-display';
import { AlertBanner, Badge } from '@clouddrive/ui-adapter/feedback';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { Skeleton } from '@clouddrive/ui-adapter/skeleton';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { StatusPill, type StatusTone } from '@clouddrive/ui-adapter/status-pill';
import { useEffect, useMemo, useState } from 'react';

import { useDictionariesStore } from '../stores/dictionaries';
import { DictionaryItemDialog, DictionaryTypeDialog } from './dictionary-dialogs';
import {
  dictionaryConsumerKey,
  sortDictionaryItems,
  type DictionaryItem,
  type DictionaryTone,
  type DictionaryType,
} from './dictionary-model';
import { useDictionariesHydration } from './use-dictionaries-hydration';

const tonePill: Record<DictionaryTone, StatusTone> = {
  default: 'neutral',
  primary: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

export function DictionariesPage() {
  const { t, locale } = useFrontendTranslation();
  const { notify } = useFeedback();
  const access = useProductAccess();
  const allowed = access.data?.permissions.includes('settings.update') ?? false;
  const accessSettled = access.data !== null;
  const { status: hydration, recover } = useDictionariesHydration();
  const types = useDictionariesStore((state) => state.types);
  const items = useDictionariesStore((state) => state.items);
  const setWritable = useDictionariesStore((state) => state.setWritable);
  const removeType = useDictionariesStore((state) => state.removeType);
  const removeItem = useDictionariesStore((state) => state.removeItem);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<DictionaryType | null>(null);
  const [typeFailure, setTypeFailure] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<DictionaryItem | null>(null);
  const [itemFailure, setItemFailure] = useState<string | null>(null);

  useEffect(() => {
    setWritable(allowed);
  }, [allowed, setWritable]);

  const selectedType = types.find((type) => type.id === selectedTypeId) ?? types[0] ?? null;
  const selectedItems = useMemo(
    () =>
      selectedType === null
        ? []
        : sortDictionaryItems(items.filter((item) => item.typeId === selectedType.id)),
    [items, selectedType],
  );

  const typeColumns: readonly DataColumn<DictionaryType>[] = [
    {
      id: 'name',
      label: t('dictionaries.columns.typeName'),
      rowHeader: true,
      render: (type) => (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Action variant="quiet" size="sm" onPress={() => setSelectedTypeId(type.id)}>
            {type.name}
          </Action>
          {selectedType?.id === type.id ? (
            <Badge tone="info">{t('dictionaries.selected')}</Badge>
          ) : null}
        </div>
      ),
    },
    {
      id: 'code',
      label: t('dictionaries.columns.code'),
      render: (type) => <span className="font-mono text-xs text-ink-muted">{type.code}</span>,
    },
    {
      id: 'status',
      label: t('dictionaries.columns.status'),
      render: (type) => (
        <StatusPill tone={type.status === 'active' ? 'success' : 'neutral'}>
          {t(`dictionaries.status.${type.status}`)}
        </StatusPill>
      ),
    },
    {
      id: 'remark',
      label: t('dictionaries.columns.remark'),
      render: (type) => (
        <span className="block max-w-48 truncate text-ink-muted" title={type.remark}>
          {type.remark}
        </span>
      ),
    },
    {
      id: 'updatedAt',
      label: t('dictionaries.columns.updatedAt'),
      render: (type) => (
        <span className="whitespace-nowrap text-ink-muted">
          {formatDate(locale, type.updatedAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      label: t('dictionaries.columns.actions'),
      render: (type) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {allowed ? (
            <DictionaryTypeDialog
              key={`type:${type.id}:${type.version}`}
              mode="edit"
              triggerLabel={t('dictionaries.actions.edit')}
              types={types}
              dictionaryType={type}
            />
          ) : (
            <Action size="sm" variant="quiet" disabled>
              {t('dictionaries.actions.edit')}
            </Action>
          )}
          <IconAction
            label={t('dictionaries.actions.delete')}
            tooltip
            size="sm"
            tone="danger"
            disabled={!allowed}
            onPress={() => {
              setTypeFailure(null);
              setPendingType(type);
            }}
          >
            <Trash2 className="size-3.5" />
          </IconAction>
        </div>
      ),
    },
  ];

  const itemColumns: readonly DataColumn<DictionaryItem>[] = [
    {
      id: 'label',
      label: t('dictionaries.columns.label'),
      rowHeader: true,
      render: (item) => <span className="font-semibold text-ink">{item.label}</span>,
    },
    {
      id: 'value',
      label: t('dictionaries.columns.value'),
      render: (item) => <span className="font-mono text-xs text-ink-muted">{item.value}</span>,
    },
    {
      id: 'order',
      label: t('dictionaries.columns.order'),
      render: (item) => <span className="tabular-nums">{item.order}</span>,
    },
    {
      id: 'status',
      label: t('dictionaries.columns.status'),
      render: (item) => (
        <StatusPill tone={item.status === 'active' ? 'success' : 'neutral'}>
          {t(`dictionaries.status.${item.status}`)}
        </StatusPill>
      ),
    },
    {
      id: 'tone',
      label: t('dictionaries.columns.tone'),
      render: (item) => (
        <StatusPill tone={tonePill[item.tone]}>{t(`dictionaries.tone.${item.tone}`)}</StatusPill>
      ),
    },
    {
      id: 'actions',
      label: t('dictionaries.columns.actions'),
      render: (item) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {allowed ? (
            <DictionaryItemDialog
              key={`item:${item.id}:${item.version}`}
              mode="edit"
              triggerLabel={t('dictionaries.actions.edit')}
              typeId={item.typeId}
              items={items}
              item={item}
            />
          ) : (
            <Action size="sm" variant="quiet" disabled>
              {t('dictionaries.actions.edit')}
            </Action>
          )}
          <IconAction
            label={t('dictionaries.actions.delete')}
            tooltip
            size="sm"
            tone="danger"
            disabled={!allowed}
            onPress={() => {
              setItemFailure(null);
              setPendingItem(item);
            }}
          >
            <Trash2 className="size-3.5" />
          </IconAction>
        </div>
      ),
    },
  ];

  const consumerKey = selectedType === null ? null : dictionaryConsumerKey(selectedType.code);
  const phase = hydration === 'error' ? 'error' : hydration === 'hydrated' ? 'ready' : 'initial';

  return (
    <Page>
      <PageHeader
        eyebrow={t('dictionaries.eyebrow')}
        title={t('dictionaries.title')}
        description={t('dictionaries.description')}
        actions={
          accessSettled ? undefined : (
            <StatusPill tone="neutral">{t('dictionaries.permissionPending')}</StatusPill>
          )
        }
      />
      {accessSettled && !allowed ? (
        <AlertBanner
          tone="warning"
          icon={<NavigationIcon iconId="catalog" />}
          title={t('dictionaries.readonlyTitle')}
          description={t('dictionaries.readonlyDescription')}
          announcement="polite"
        />
      ) : null}
      <AsyncRegion
        phase={phase}
        label={t('dictionaries.typesLabel')}
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
            icon={<NavigationIcon iconId="catalog" />}
            title={t('dictionaries.hydration.title')}
            description={t('dictionaries.hydration.description')}
            actionLabel={t('dictionaries.hydration.reset')}
            onAction={recover}
            announcement="polite"
          />
        }
        empty={null}
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0">
            <Section
              title={t('dictionaries.types')}
              description={t('dictionaries.typesCount', {
                count: types.length,
                value: formatNumber(locale, types.length),
              })}
              action={
                allowed ? (
                  <DictionaryTypeDialog
                    mode="create"
                    triggerLabel={t('dictionaries.actions.createType')}
                    types={types}
                    onCreated={setSelectedTypeId}
                  />
                ) : (
                  <Action size="sm" disabled>
                    {t('dictionaries.actions.createType')}
                  </Action>
                )
              }
            >
              <DataTable
                label={t('dictionaries.typesLabel')}
                columns={typeColumns}
                rows={types}
                density="compact"
                emptyContent={
                  <p className="text-sm text-ink-muted">{t('dictionaries.empty.types')}</p>
                }
              />
            </Section>
          </div>
          <div className="grid min-w-0 gap-6 lg:col-span-2">
            <Section
              title={selectedType === null ? t('dictionaries.items') : selectedType.name}
              description={
                selectedType === null
                  ? t('dictionaries.items')
                  : `${selectedType.code} · ${t('dictionaries.itemsCount', {
                      count: selectedItems.length,
                      value: formatNumber(locale, selectedItems.length),
                    })}`
              }
              action={
                selectedType === null ? null : allowed ? (
                  <DictionaryItemDialog
                    key={`create-item:${selectedType.id}`}
                    mode="create"
                    triggerLabel={t('dictionaries.actions.createItem')}
                    typeId={selectedType.id}
                    items={items}
                  />
                ) : (
                  <Action size="sm" disabled>
                    {t('dictionaries.actions.createItem')}
                  </Action>
                )
              }
            >
              {selectedType === null ? (
                <StateSurface
                  state="empty"
                  icon={<NavigationIcon iconId="catalog" />}
                  title={t('dictionaries.empty.types')}
                  description={t('dictionaries.empty.typesDescription')}
                  compact
                />
              ) : selectedItems.length === 0 ? (
                <StateSurface
                  state="empty"
                  icon={<NavigationIcon iconId="catalog" />}
                  title={t('dictionaries.empty.items')}
                  description={t('dictionaries.empty.itemsDescription')}
                  compact
                />
              ) : (
                <DataTable
                  label={t('dictionaries.itemsLabel')}
                  columns={itemColumns}
                  rows={selectedItems}
                  density="compact"
                  emptyContent={
                    <p className="text-sm text-ink-muted">{t('dictionaries.empty.items')}</p>
                  }
                />
              )}
            </Section>
            <Section
              title={t('dictionaries.reference.title')}
              description={t('dictionaries.reference.description')}
            >
              <div className="p-5 text-sm leading-6 text-ink-muted">
                <p>
                  {selectedType === null
                    ? t('dictionaries.reference.none')
                    : consumerKey === null
                      ? t('dictionaries.reference.none')
                      : t(`dictionaries.reference.${consumerKey}`)}
                </p>
                {selectedType === null ? null : (
                  <p className="mt-2 font-mono text-xs text-ink-muted">{selectedType.code}</p>
                )}
              </div>
            </Section>
          </div>
        </div>
      </AsyncRegion>
      <ConfirmDialog
        triggerLabel=""
        title={t('dictionaries.typeDelete.title')}
        description={t('dictionaries.typeDelete.description', {
          name: pendingType?.name ?? '',
          count:
            pendingType === null
              ? 0
              : items.filter((item) => item.typeId === pendingType.id).length,
        })}
        impact={t('dictionaries.typeDelete.impact')}
        cancelLabel={t('dictionaries.typeDelete.cancel')}
        confirmLabel={t('dictionaries.typeDelete.confirm')}
        failureMessage={typeFailure ?? t('dictionaries.typeDelete.failure')}
        tone="danger"
        confirmDisabled={!allowed}
        isOpen={pendingType !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingType(null);
            setTypeFailure(null);
          }
        }}
        onConfirm={() => {
          if (pendingType === null) return;
          const result = removeType(pendingType.id, pendingType.version);
          if (!result.ok) {
            setTypeFailure(
              result.code === 'conflict'
                ? t('dictionaries.conflict')
                : t('dictionaries.typeDelete.failure'),
            );
            throw new Error(`dictionaries: delete type ${result.code}`);
          }
          setPendingType(null);
          notify({ title: t('dictionaries.typeDeleted'), tone: 'success' });
        }}
      />
      <ConfirmDialog
        triggerLabel=""
        title={t('dictionaries.itemDelete.title')}
        description={t('dictionaries.itemDelete.description', {
          label: pendingItem?.label ?? '',
        })}
        impact={t('dictionaries.itemDelete.impact')}
        cancelLabel={t('dictionaries.itemDelete.cancel')}
        confirmLabel={t('dictionaries.itemDelete.confirm')}
        failureMessage={itemFailure ?? t('dictionaries.itemDelete.failure')}
        tone="danger"
        confirmDisabled={!allowed}
        isOpen={pendingItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingItem(null);
            setItemFailure(null);
          }
        }}
        onConfirm={() => {
          if (pendingItem === null) return;
          const result = removeItem(pendingItem.id, pendingItem.version);
          if (!result.ok) {
            setItemFailure(
              result.code === 'conflict'
                ? t('dictionaries.conflict')
                : t('dictionaries.itemDelete.failure'),
            );
            throw new Error(`dictionaries: delete item ${result.code}`);
          }
          setPendingItem(null);
          notify({ title: t('dictionaries.deleteSuccess'), tone: 'success' });
        }}
      />
    </Page>
  );
}

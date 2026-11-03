'use client';

import { Action } from '@clouddrive/ui-adapter/action';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { ToggleGroup } from '@clouddrive/ui-adapter/toggle-group';
import {
  CheckCircle2,
  ChevronRight,
  Grid2X2,
  LayoutList,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Section } from '@clouddrive/surface-foundation/layout';
import { ComponentPreview } from './component-preview';
import { UiElementsFamilyPage } from './family-page';
export function ActionsSelectionPage() {
  const { t } = useFrontendTranslation();
  const [lastAction, setLastAction] = useState<string>();
  const [viewModes, setViewModes] = useState<readonly string[]>(['grid']);
  const [visibleColumns, setVisibleColumns] = useState<readonly string[]>(['owner', 'status']);
  return (
    <UiElementsFamilyPage
      familyId="actions-selection"
      title={t('uiElements.nav.actionsSelection')}
      description={t('uiElements.shortDescription')}
    >
      {({ description, spacing }) => (
        <>
          <Section id="actions" title={t('uiElements.actionsTitle')} description={description}>
            <div data-reveal-items className="grid gap-4 p-5 lg:grid-cols-2">
              <ComponentPreview
                fullWidth
                name="Action"
                description={t('uiElements.catalog.actionDescription')}
                states={[
                  'Primary',
                  'Secondary',
                  'Quiet',
                  'Danger',
                  'sm / md / lg',
                  'Icon',
                  'Pending',
                  'Disabled',
                ]}
              >
                <div className={`flex flex-wrap items-center ${spacing}`}>
                  <Action
                    leadingIcon={<CheckCircle2 />}
                    onPress={() => setLastAction(t('uiElements.primary'))}
                  >
                    {t('uiElements.primary')}
                  </Action>
                  <Action
                    trailingIcon={<ChevronRight />}
                    variant="secondary"
                    onPress={() => setLastAction(t('uiElements.secondary'))}
                  >
                    {t('uiElements.secondary')}
                  </Action>
                  <Action variant="quiet" onPress={() => setLastAction(t('uiElements.quiet'))}>
                    {t('uiElements.quiet')}
                  </Action>
                  <Action variant="danger" onPress={() => setLastAction(t('uiElements.danger'))}>
                    {t('uiElements.danger')}
                  </Action>
                  <Action size="sm" onPress={() => setLastAction(t('uiElements.small'))}>
                    {t('uiElements.small')}
                  </Action>
                  <Action size="lg" onPress={() => setLastAction(t('uiElements.catalog.large'))}>
                    {t('uiElements.catalog.large')}
                  </Action>
                  <Action loading disabled>
                    {t('uiElements.loading')}
                  </Action>
                  <Action disabled>{t('uiElements.disabled')}</Action>
                </div>
                {lastAction ? (
                  <p className="mt-4 text-sm text-ink-muted" role="status">
                    {t('uiElements.catalog.lastAction', { action: lastAction })}
                  </p>
                ) : null}
              </ComponentPreview>
              <ComponentPreview
                name="IconAction"
                description={t('uiElements.catalog.iconActionDescription')}
                states={['sm / md', 'Active', 'Danger', 'Pending', 'Disabled', 'Accessible name']}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <IconAction
                    label={t('uiElements.catalog.search')}
                    onPress={() => setLastAction(t('uiElements.catalog.search'))}
                  >
                    <Search className="size-icon-sm" />
                  </IconAction>
                  <IconAction
                    active
                    label={t('uiElements.catalog.refresh')}
                    onPress={() => setLastAction(t('uiElements.catalog.refresh'))}
                  >
                    <RefreshCw className="size-icon-sm" />
                  </IconAction>
                  <IconAction
                    label={t('uiElements.catalog.delete')}
                    tone="danger"
                    onPress={() => setLastAction(t('uiElements.catalog.delete'))}
                  >
                    <Trash2 className="size-icon-sm" />
                  </IconAction>
                  <IconAction
                    label={t('uiElements.catalog.more')}
                    size="sm"
                    onPress={() => setLastAction(t('uiElements.catalog.more'))}
                  >
                    <MoreHorizontal className="size-icon-sm" />
                  </IconAction>
                  <IconAction disabled loading label={t('uiElements.catalog.refreshing')}>
                    <RefreshCw className="size-icon-sm" />
                  </IconAction>
                  <IconAction disabled label={t('uiElements.catalog.moreDisabled')}>
                    <MoreHorizontal className="size-icon-sm" />
                  </IconAction>
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="ToggleGroup"
                description={t('uiElements.catalog.toggleDescription')}
                states={['Single', 'Multiple', 'Selected', 'Disabled item', 'sm / md', 'Icon']}
              >
                <div className="grid gap-5">
                  <ToggleGroup
                    label={t('uiElements.catalog.viewMode')}
                    options={[
                      { id: 'grid', label: t('uiElements.catalog.grid'), icon: <Grid2X2 /> },
                      { id: 'list', label: t('uiElements.catalog.list'), icon: <LayoutList /> },
                      { id: 'locked', label: t('uiElements.catalog.locked'), disabled: true },
                    ]}
                    selectedIds={viewModes}
                    onSelectionChange={setViewModes}
                    selectionMode="single"
                  />
                  <ToggleGroup
                    label={t('uiElements.catalog.visibleColumns')}
                    options={[
                      { id: 'owner', label: t('uiElements.dataTableColumns.owner') },
                      { id: 'status', label: t('uiElements.dataTableColumns.status') },
                    ]}
                    selectedIds={visibleColumns}
                    onSelectionChange={setVisibleColumns}
                    selectionMode="multiple"
                    size="sm"
                  />
                </div>
              </ComponentPreview>
            </div>
          </Section>
        </>
      )}
    </UiElementsFamilyPage>
  );
}

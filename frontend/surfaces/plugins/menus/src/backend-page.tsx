'use client';
import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField, SelectField, CheckboxField } from '@clouddrive/ui-adapter/form-field';
import { DataTable } from '@clouddrive/ui-adapter/data-display';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useRequiredAdministration } from '../../../src/administration/context';
import { useRemote, RemoteRegion } from '../../../src/administration/resource-state';
import type { MenuItem } from '../../../src/administration/model';
function MenuEditor({
  menu,
  menus,
  onSaved,
}: Readonly<{ menu: MenuItem; menus: readonly MenuItem[]; onSaved: () => void }>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const [value, setValue] = useState(menu);
  const [failure, setFailure] = useState<string>();
  return (
    <DialogSurface
      triggerLabel={t('administration.edit')}
      title={t(menu.titleMessageId)}
      description={t('administration.description')}
      cancelLabel={t('administration.cancel')}
      confirmLabel={t('administration.save')}
      {...(failure ? { failureMessage: failure } : {})}
      onConfirm={async () => {
        try {
          await port.saveMenu(value);
          onSaved();
        } catch (error) {
          setFailure(t('administration.failureDescription'));
          throw error;
        }
      }}
    >
      <TextField
        label={t('administration.label')}
        value={value.label}
        onChange={(event) => setValue((prior) => ({ ...prior, label: event.target.value }))}
      />
      <TextField
        label={t('administration.order')}
        value={String(value.order)}
        onChange={(event) => setValue((prior) => ({ ...prior, order: Number(event.target.value) }))}
      />
      <TextField
        label={t('administration.permissions')}
        value={value.permission}
        onChange={(event) => setValue((prior) => ({ ...prior, permission: event.target.value }))}
      />
      <SelectField
        label={t('administration.parent')}
        disabled={menu.id.startsWith('group:')}
        value={value.parentId}
        onValueChange={(parentId) => setValue((prior) => ({ ...prior, parentId }))}
        options={[
          ...(menu.id.startsWith('group:') ? [{ value: '', label: t('administration.root') }] : []),
          ...menus
            .filter(
              (item) =>
                item.id !== menu.id &&
                (item.id.startsWith('group:') ||
                  (!menus.some((child) => child.defaultParentId === menu.id) &&
                    menus.some((child) => child.defaultParentId === item.id))),
            )
            .map((item) => ({ value: item.id, label: item.label || t(item.titleMessageId) })),
        ]}
      />
      <CheckboxField
        label={t('administration.enabled')}
        checked={value.enabled}
        onCheckedChange={(enabled) => setValue((prior) => ({ ...prior, enabled }))}
      />
    </DialogSurface>
  );
}
export function BackendMenusPage() {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const state = useRemote(useCallback(() => port.menus(), [port]));
  return (
    <Page>
      <PageHeader title={t('administration.menu')} description={t('administration.description')} />
      <Action onPress={state.reload}>{t('administration.refresh')}</Action>
      <RemoteRegion {...state}>
        <DataTable
          label={t('administration.menu')}
          columns={[
            {
              id: 'label',
              label: t('administration.label'),
              rowHeader: true,
              render: (row) => row.label || t(row.titleMessageId),
            },
            { id: 'route', label: t('administration.route'), render: (row) => row.routeId },
            {
              id: 'enabled',
              label: t('administration.status'),
              render: (row) => t(row.enabled ? 'administration.active' : 'administration.disabled'),
            },
            {
              id: 'actions',
              label: t('administration.actions'),
              render: (row) => (
                <MenuEditor
                  key={`${row.id}-${row.version}`}
                  menu={row}
                  menus={state.value ?? []}
                  onSaved={state.reload}
                />
              ),
            },
          ]}
          rows={state.value ?? []}
          emptyContent={t('administration.empty')}
        />
      </RemoteRegion>
    </Page>
  );
}

'use client';
import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { SelectField, CheckboxField } from '@clouddrive/ui-adapter/form-field';
import { DataTable } from '@clouddrive/ui-adapter/data-display';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useIdentityPort } from '@clouddrive/surface/identity/runtime';
import { useRequiredAdministration } from '../../../src/administration/context';
import { useRemote, RemoteRegion } from '../../../src/administration/resource-state';
function PermissionEditor({ id }: Readonly<{ id: string }>) {
  const port = useRequiredAdministration();
  const state = useRemote(
    useCallback(async () => {
      const [permissions, role] = await Promise.all([port.permissions(), port.rolePermissions(id)]);
      return { permissions, role };
    }, [port, id]),
  );
  return (
    <RemoteRegion {...state}>
      {state.value ? (
        <PermissionDialog
          key={`${id}-${state.value.role.roleVersion}`}
          {...state.value}
          onSaved={state.reload}
        />
      ) : null}
    </RemoteRegion>
  );
}
function PermissionDialog({
  permissions,
  role,
  onSaved,
}: Readonly<{
  permissions: Awaited<ReturnType<ReturnType<typeof useRequiredAdministration>['permissions']>>;
  role: Awaited<ReturnType<ReturnType<typeof useRequiredAdministration>['rolePermissions']>>;
  onSaved: () => void;
}>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const [keys, setKeys] = useState(role.permissionKeys);
  const [failure, setFailure] = useState<string>();
  return (
    <DialogSurface
      triggerLabel={t('administration.edit')}
      title={t('administration.permissions')}
      description={t('administration.description')}
      cancelLabel={t('administration.cancel')}
      confirmLabel={t('administration.save')}
      {...(failure ? { failureMessage: failure } : {})}
      onConfirm={async () => {
        try {
          await port.replaceRolePermissions({ ...role, permissionKeys: keys });
          onSaved();
        } catch (error) {
          setFailure(t('administration.failureDescription'));
          throw error;
        }
      }}
    >
      {permissions.map((permission) => (
        <CheckboxField
          key={permission.key}
          label={permission.key}
          checked={keys.includes(permission.key)}
          onCheckedChange={(checked) =>
            setKeys((prior) =>
              checked ? [...prior, permission.key] : prior.filter((key) => key !== permission.key),
            )
          }
        />
      ))}
    </DialogSurface>
  );
}
export function PermissionCatalogPage() {
  const port = useRequiredAdministration();
  const identity = useIdentityPort();
  const { t } = useFrontendTranslation();
  const [roleId, setRoleId] = useState('');
  const state = useRemote(
    useCallback(async () => {
      const [permissions, roles] = await Promise.all([port.permissions(), identity.roles()]);
      return { permissions, roles };
    }, [port, identity]),
  );
  return (
    <Page>
      <PageHeader
        title={t('administration.permissions')}
        description={t('administration.description')}
      />
      <RemoteRegion {...state}>
        <Section title={t('administration.roles')}>
          <SelectField
            label={t('administration.roles')}
            value={roleId}
            onValueChange={setRoleId}
            options={[
              { value: '', label: t('administration.empty') },
              ...(state.value?.roles ?? [])
                .filter((role) => !role.protected)
                .map((role) => ({ value: role.id, label: role.name })),
            ]}
          />
          {roleId ? <PermissionEditor key={roleId} id={roleId} /> : null}
        </Section>
        <DataTable
          label={t('administration.permissions')}
          columns={[
            { id: 'key', label: t('administration.id'), rowHeader: true, render: (row) => row.key },
            { id: 'owner', label: t('administration.owner'), render: (row) => row.ownerModuleId },
            { id: 'risk', label: t('administration.risk'), render: (row) => row.risk },
          ]}
          rows={(state.value?.permissions ?? []).map((item) => ({ ...item, id: item.key }))}
          emptyContent={t('administration.empty')}
        />
      </RemoteRegion>
    </Page>
  );
}

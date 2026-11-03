'use client';
import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField, SelectField, CheckboxField } from '@clouddrive/ui-adapter/form-field';
import { DataTable, type DataColumn } from '@clouddrive/ui-adapter/data-display';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useRequiredAdministration } from '../../../src/administration/context';
import { useRemote, RemoteRegion } from '../../../src/administration/resource-state';
import type { OrganizationItem, OrganizationKind } from '../../../src/administration/model';

function OrganizationEditor({
  kind,
  item,
  items,
  onSaved,
}: Readonly<{
  kind: OrganizationKind;
  item?: OrganizationItem;
  items: readonly OrganizationItem[];
  onSaved: () => void;
}>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const [name, setName] = useState(item?.name ?? '');
  const [code, setCode] = useState(item?.code ?? '');
  const [parentId, setParent] = useState(item?.parentId ?? '');
  const [active, setActive] = useState(item?.active ?? true);
  const [archived, setArchived] = useState(item?.archived ?? false);
  const [leader, setLeader] = useState(item?.leader ?? '');
  const [remark, setRemark] = useState(item?.remark ?? '');
  const [failure, setFailure] = useState<string>();
  return (
    <DialogSurface
      triggerLabel={t(item ? 'administration.edit' : 'administration.create')}
      title={t(`administration.${kind}`)}
      description={t('administration.description')}
      cancelLabel={t('administration.cancel')}
      confirmLabel={t('administration.save')}
      {...(failure ? { failureMessage: failure } : {})}
      onConfirm={async () => {
        try {
          await port.saveOrganization(
            kind,
            { name, code, parentId, active, leader, remark, archived },
            item,
          );
          setFailure(undefined);
          onSaved();
        } catch (error) {
          setFailure(t('administration.failureDescription'));
          throw error;
        }
      }}
    >
      <TextField
        label={t('administration.name')}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <TextField
        label={t('administration.code')}
        value={code}
        disabled={!!item}
        onChange={(event) => setCode(event.target.value)}
      />
      {kind === 'departments' ? (
        <>
          <TextField
            label={t('administration.leader')}
            value={leader}
            onChange={(event) => setLeader(event.target.value)}
          />
          <TextField
            label={t('administration.remark')}
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
          />
          <SelectField
            label={t('administration.parent')}
            value={parentId}
            onValueChange={setParent}
            options={[
              { value: '', label: t('administration.root') },
              ...items
                .filter((other) => other.id !== item?.id && !other.archived)
                .map((other) => ({ value: other.id, label: other.name })),
            ]}
          />
        </>
      ) : null}
      {item ? (
        <CheckboxField
          label={t('administration.archive')}
          checked={archived}
          onCheckedChange={setArchived}
        />
      ) : null}
      {item ? (
        <CheckboxField
          label={t('administration.active')}
          checked={active}
          onCheckedChange={setActive}
        />
      ) : null}
    </DialogSurface>
  );
}
export function OrganizationPage({ kind = 'departments' }: Readonly<{ kind?: OrganizationKind }>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const state = useRemote(useCallback(() => port.organization(kind), [port, kind]));
  const columns: readonly DataColumn<OrganizationItem>[] = [
    { id: 'name', label: t('administration.name'), rowHeader: true, render: (item) => item.name },
    { id: 'code', label: t('administration.code'), render: (item) => item.code },
    {
      id: 'status',
      label: t('administration.status'),
      render: (item) => t(item.active ? 'administration.active' : 'administration.disabled'),
    },
    {
      id: 'actions',
      label: t('administration.actions'),
      render: (item) => (
        <OrganizationEditor
          key={`${item.id}-${item.version}`}
          kind={kind}
          item={item}
          items={state.value ?? []}
          onSaved={state.reload}
        />
      ),
    },
  ];
  return (
    <Page>
      <PageHeader
        title={t(`administration.${kind}`)}
        description={t('administration.description')}
      />
      <Toolbar
        label={t('administration.actions')}
        primary={
          <div className="flex flex-wrap gap-2">
            <OrganizationEditor kind={kind} items={state.value ?? []} onSaved={state.reload} />
            <Action onPress={state.reload}>{t('administration.refresh')}</Action>
          </div>
        }
      />
      <RemoteRegion {...state}>
        <DataTable
          label={t(`administration.${kind}`)}
          columns={columns}
          rows={(state.value ?? []).filter((item) => !item.archived)}
          emptyContent={t('administration.empty')}
        />
      </RemoteRegion>
    </Page>
  );
}

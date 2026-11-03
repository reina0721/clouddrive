'use client';
import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField, CheckboxField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useIdentityPort, defaultUserQuery } from '@clouddrive/surface/identity/runtime';
import { useRequiredAdministration } from '../../../src/administration/context';
import { useRemote, RemoteRegion } from '../../../src/administration/resource-state';
import type { Assignment, OrganizationItem } from '../../../src/administration/model';

function AssignmentEditor({
  value,
  departments,
  positions,
  onSaved,
}: Readonly<{
  value: Assignment;
  departments: readonly OrganizationItem[];
  positions: readonly OrganizationItem[];
  onSaved: () => void;
}>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const [department, setDepartment] = useState(value.departmentId ?? '');
  const [selected, setSelected] = useState(value.positionIds);
  const [failure, setFailure] = useState<string>();
  return (
    <DialogSurface
      triggerLabel={t('administration.edit')}
      title={t('administration.assignment')}
      description={t('administration.description')}
      cancelLabel={t('administration.cancel')}
      confirmLabel={t('administration.save')}
      {...(failure ? { failureMessage: failure } : {})}
      onConfirm={async () => {
        try {
          await port.assign({ ...value, departmentId: department || null, positionIds: selected });
          onSaved();
        } catch (error) {
          setFailure(t('administration.failureDescription'));
          throw error;
        }
      }}
    >
      <SelectField
        label={t('administration.department')}
        value={department}
        onValueChange={setDepartment}
        options={[
          { value: '', label: t('administration.root') },
          ...departments
            .filter((item) => item.active && !item.archived)
            .map((item) => ({ value: item.id, label: item.name })),
        ]}
      />
      {positions
        .filter((item) => item.active && !item.archived)
        .map((item) => (
          <CheckboxField
            key={item.id}
            label={item.name}
            checked={selected.includes(item.id)}
            onCheckedChange={(checked) =>
              setSelected((prior) =>
                checked ? [...prior, item.id] : prior.filter((id) => id !== item.id),
              )
            }
          />
        ))}
    </DialogSurface>
  );
}
function AssignmentDetails({ accountId }: Readonly<{ accountId: string }>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const state = useRemote(
    useCallback(async () => {
      const [value, departments, positions] = await Promise.all([
        port.assignment(accountId),
        port.organization('departments'),
        port.organization('positions'),
      ]);
      return { value, departments, positions };
    }, [port, accountId]),
  );
  return (
    <RemoteRegion {...state}>
      {state.value ? (
        <Section title={t('administration.assignment')}>
          <p>
            {state.value.departments.find((item) => item.id === state.value?.value.departmentId)
              ?.name ?? t('administration.root')}
          </p>
          <p>
            {state.value.positions
              .filter((item) => state.value?.value.positionIds.includes(item.id))
              .map((item) => item.name)
              .join(', ')}
          </p>
          <AssignmentEditor
            key={`${accountId}-${state.value.value.version}`}
            {...state.value}
            onSaved={state.reload}
          />
        </Section>
      ) : null}
    </RemoteRegion>
  );
}
export function AssignmentPage() {
  const identity = useIdentityPort();
  const { t } = useFrontendTranslation();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const users = useRemote(
    useCallback(
      () => identity.list({ ...defaultUserQuery, q: query, pageSize: 50 }),
      [identity, query],
    ),
  );
  return (
    <Page>
      <PageHeader
        title={t('administration.assignment')}
        description={t('administration.description')}
      />
      <TextField
        label={t('identityProduct.search')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <RemoteRegion {...users}>
        <SelectField
          label={t('administration.accountId')}
          value={selected}
          onValueChange={setSelected}
          options={[
            { value: '', label: t('administration.empty') },
            ...(users.value?.items ?? []).map((item) => ({
              value: item.id,
              label: item.name + ' · ' + item.email,
            })),
          ]}
        />
      </RemoteRegion>
      {selected ? (
        <AssignmentDetails key={selected} accountId={selected} />
      ) : (
        <Action onPress={users.reload}>{t('administration.refresh')}</Action>
      )}
    </Page>
  );
}

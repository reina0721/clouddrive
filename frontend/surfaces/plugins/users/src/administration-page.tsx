'use client';
import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { TextField, PasswordField, SelectField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useIdentityPort, defaultUserQuery } from '@clouddrive/surface/identity/runtime';
import { useRequiredAdministration } from '../../../src/administration/context';
import { useRemote, RemoteRegion } from '../../../src/administration/resource-state';

function AccountAction({
  id,
  version,
  archive,
  onSaved,
}: Readonly<{ id: string; version: number; archive: boolean; onSaved: () => void }>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const [password, setPassword] = useState('');
  const [failure, setFailure] = useState<string>();
  const label = t(archive ? 'administration.archive' : 'administration.resetPassword');
  return (
    <DialogSurface
      triggerLabel={label}
      title={label}
      description={t('administration.archiveWarning')}
      cancelLabel={t('administration.cancel')}
      confirmLabel={t('administration.confirm')}
      {...(failure ? { failureMessage: failure } : {})}
      onConfirm={async () => {
        try {
          if (archive) await port.archiveAccount(id, version);
          else await port.resetPassword(id, password, version);
          setPassword('');
          onSaved();
        } catch (error) {
          setFailure(t('administration.failureDescription'));
          throw error;
        }
      }}
    >
      {archive ? (
        <p>{t('administration.archiveWarning')}</p>
      ) : (
        <PasswordField
          label={t('administration.newPassword')}
          purpose="new"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          showLabel={t('account.showPassword')}
          hideLabel={t('account.hidePassword')}
        />
      )}
    </DialogSurface>
  );
}
export function AccountAdministrationPage() {
  const identity = useIdentityPort();
  const { t } = useFrontendTranslation();
  const [query, setQuery] = useState('');
  const [id, setId] = useState('');
  const state = useRemote(
    useCallback(
      () => identity.list({ ...defaultUserQuery, q: query, pageSize: 50 }),
      [identity, query],
    ),
  );
  return (
    <Page>
      <PageHeader
        title={t('administration.adminActions')}
        description={t('administration.description')}
      />
      <TextField
        label={t('identityProduct.search')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <RemoteRegion {...state}>
        <SelectField
          label={t('administration.accountId')}
          value={id}
          onValueChange={setId}
          options={[
            { value: '', label: t('administration.empty') },
            ...(state.value?.items ?? []).map((user) => ({
              value: user.id,
              label: user.name + ' · ' + user.email,
            })),
          ]}
        />
        {id ? (
          <div className="flex flex-wrap gap-2">
            <AccountAction
              version={state.value?.items.find((user) => user.id === id)?.version ?? 0}
              id={id}
              archive
              onSaved={() => {
                setId('');
                state.reload();
              }}
            />
            <AccountAction
              version={state.value?.items.find((user) => user.id === id)?.version ?? 0}
              id={id}
              archive={false}
              onSaved={state.reload}
            />
          </div>
        ) : null}
      </RemoteRegion>
    </Page>
  );
}

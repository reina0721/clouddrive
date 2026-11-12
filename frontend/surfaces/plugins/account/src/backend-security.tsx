'use client';
import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, Section, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { DataTable, type DataColumn } from '@clouddrive/ui-adapter/data-display';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useRequiredAdministration } from '../../../src/administration/context';
import { useRemote, RemoteRegion } from '../../../src/administration/resource-state';
import type { AccessToken } from '../../../src/administration/model';
import { IdentityError } from '../../../src/identity/errors';

function MfaAction({
  action,
  onSaved,
  onCodes,
  onEnrollment,
}: Readonly<{
  action: 'begin' | 'confirm' | 'disable';
  onSaved: () => void;
  onCodes: (value: readonly string[]) => void;
  onEnrollment: (value: { secret: string; uri: string } | undefined) => void;
}>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const [code, setCode] = useState('');
  const [failure, setFailure] = useState<string>();
  const label = t(
    action === 'begin'
      ? 'administration.mfaBegin'
      : action === 'confirm'
        ? 'administration.mfaConfirm'
        : 'administration.mfaDisable',
  );
  return (
    <DialogSurface
      triggerLabel={label}
      title={label}
      description={t('administration.description')}
      cancelLabel={t('administration.cancel')}
      confirmLabel={t('administration.confirm')}
      confirmDisabled={action !== 'begin' && !code.trim()}
      {...(failure ? { failureMessage: failure } : {})}
      onConfirm={async () => {
        try {
          if (action === 'begin') {
            const result = await port.beginMfa();
            onCodes([]);
            onEnrollment(result);
          } else if (action === 'confirm') {
            onCodes(await port.confirmMfa(code.trim()));
            onEnrollment(undefined);
            onSaved();
          } else {
            await port.disableMfa(code.trim());
            onCodes([]);
            onEnrollment(undefined);
            onSaved();
          }
          setCode('');
        } catch (error) {
          setFailure(t('administration.failureDescription'));
          throw error;
        }
      }}
    >
      {action === 'begin' ? (
        <p>{t('administration.mfaSecret')}</p>
      ) : (
        <TextField
          label={t(action === 'confirm' ? 'administration.mfaSetupCode' : 'administration.mfaCode')}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
        />
      )}
    </DialogSurface>
  );
}
export function BackendSecurityPage() {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const mfa = useRemote(useCallback(() => port.mfaStatus(), [port]));
  const [codes, setCodes] = useState<readonly string[]>([]);
  const [enrollment, setEnrollment] = useState<{ secret: string; uri: string }>();
  const [archiveFailure, setArchiveFailure] = useState<string>();
  return (
    <Page>
      <PageHeader
        title={t('administration.security')}
        description={t('administration.description')}
      />
      <RemoteRegion {...mfa}>
        <Section title={t('administration.mfa')}>
          <p>{t(mfa.value ? 'administration.active' : 'administration.disabled')}</p>
          <Toolbar
            label={t('administration.actions')}
            primary={
              <div className="flex flex-wrap gap-2">
                {!mfa.value ? (
                  <>
                    {!enrollment ? (
                      <MfaAction
                        action="begin"
                        onSaved={mfa.reload}
                        onCodes={setCodes}
                        onEnrollment={setEnrollment}
                      />
                    ) : null}
                    {enrollment ? (
                      <MfaAction
                        action="confirm"
                        onSaved={mfa.reload}
                        onCodes={setCodes}
                        onEnrollment={setEnrollment}
                      />
                    ) : null}
                  </>
                ) : (
                  <MfaAction
                    action="disable"
                    onSaved={mfa.reload}
                    onCodes={setCodes}
                    onEnrollment={setEnrollment}
                  />
                )}
              </div>
            }
          />
          {enrollment ? (
            <div className="space-y-3">
              <p>{t('administration.mfaSetupHint')}</p>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-medium">{t('administration.mfaSecret')}</dt>
                  <dd className="break-all font-mono">{enrollment.secret}</dd>
                </div>
                <div>
                  <dt className="font-medium">{t('administration.mfaUri')}</dt>
                  <dd className="break-all font-mono">{enrollment.uri}</dd>
                </div>
              </dl>
            </div>
          ) : null}
          {codes.length ? (
            <div className="space-y-2">
              <p>{t('administration.recovery')}</p>
              {codes.map((code, index) => (
                <p key={index} className="break-all font-mono text-sm">
                  {code}
                </p>
              ))}
              <Action onPress={() => setCodes([])}>{t('administration.confirm')}</Action>
            </div>
          ) : null}
        </Section>
      </RemoteRegion>
      <Section title={t('administration.archiveSelf')}>
        <DialogSurface
          triggerLabel={t('administration.archiveSelf')}
          title={t('administration.archiveSelf')}
          description={t('administration.archiveWarning')}
          cancelLabel={t('administration.cancel')}
          confirmLabel={t('administration.confirm')}
          {...(archiveFailure ? { failureMessage: archiveFailure } : {})}
          onConfirm={async () => {
            try {
              const confirmation = await port.beginArchive();
              await port.confirmArchive(confirmation);
              port.endSession();
            } catch (error) {
              setArchiveFailure(t('administration.failureDescription'));
              throw error;
            }
          }}
        >
          <p>{t('administration.archiveWarning')}</p>
        </DialogSurface>
      </Section>
    </Page>
  );
}
function TokenAction({
  token,
  action,
  onSaved,
  onSecret,
}: Readonly<{
  token?: AccessToken;
  action: 'create' | 'edit' | 'enable' | 'disable' | 'revoke' | 'rotate';
  onSaved: () => void;
  onSecret: (secret: string) => void;
}>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const [name, setName] = useState(token?.name ?? '');
  const [description, setDescription] = useState(token?.description ?? '');
  const [expiresAt, setExpiresAt] = useState(token?.expiresAt ?? '');
  const [scopes, setScopes] = useState(token?.scopes.join(', ') ?? '');
  const [failure, setFailure] = useState<string>();
  return (
    <DialogSurface
      triggerLabel={t(`administration.${action}`)}
      title={t('administration.tokens')}
      description={token?.name ?? t('administration.description')}
      cancelLabel={t('administration.cancel')}
      confirmLabel={t('administration.confirm')}
      confirmDisabled={(action === 'create' || action === 'edit') && !name.trim()}
      {...(failure ? { failureMessage: failure } : {})}
      onConfirm={async () => {
        try {
          const result =
            action === 'create'
              ? await port.createToken(
                  name.trim(),
                  scopes
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean),
                  description,
                  expiresAt || undefined,
                )
              : token
                ? action === 'edit'
                  ? (await port.updateToken({
                      ...token,
                      name: name.trim(),
                      description,
                      ...(expiresAt ? { expiresAt } : { expiresAt: undefined }),
                    }),
                    null)
                  : await port.tokenAction(token.id, action, token.version)
                : null;
          if (result?.secret) onSecret(result.secret);
          setName('');
          setScopes('');
          onSaved();
        } catch (error) {
          setFailure(
            error instanceof IdentityError
              ? t('identityProduct.errors.' + error.code)
              : t('administration.failureDescription'),
          );
          throw error;
        }
      }}
    >
      {action === 'create' || action === 'edit' ? (
        <>
          <TextField
            label={t('administration.name')}
            maxLength={128}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            label={t('administration.remark')}
            maxLength={1024}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <TextField
            label={t('administration.expiresAt')}
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
          <TextField
            disabled={action === 'edit'}
            label={t('administration.scopes')}
            value={scopes}
            onChange={(event) => setScopes(event.target.value)}
          />
        </>
      ) : (
        <p>{token?.name}</p>
      )}
    </DialogSurface>
  );
}
export function BackendTokensPage() {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const state = useRemote(useCallback(() => port.tokens(), [port]));
  const [secret, setSecret] = useState('');
  const columns: readonly DataColumn<AccessToken>[] = [
    { id: 'name', label: t('administration.name'), rowHeader: true, render: (item) => item.name },
    { id: 'status', label: t('administration.status'), render: (item) => item.status },
    { id: 'scopes', label: t('administration.scopes'), render: (item) => item.scopes.join(', ') },
    {
      id: 'actions',
      label: t('administration.actions'),
      render: (item) => (
        <div className="flex flex-wrap gap-2">
          {(['edit', 'enable', 'disable', 'rotate', 'revoke'] as const)
            .filter(
              (action) =>
                item.status !== 'revoked' &&
                (action !== 'enable' || item.status === 'disabled') &&
                (action !== 'disable' || item.status === 'active'),
            )
            .map((action) => (
              <TokenAction
                key={`${action}-${item.version}`}
                token={item}
                action={action}
                onSaved={state.reload}
                onSecret={setSecret}
              />
            ))}
        </div>
      ),
    },
  ];
  return (
    <Page>
      <PageHeader
        title={t('administration.tokens')}
        description={t('administration.description')}
      />
      <Toolbar
        label={t('administration.actions')}
        primary={
          <div className="flex flex-wrap gap-2">
            <TokenAction action="create" onSaved={state.reload} onSecret={setSecret} />
            <Action onPress={state.reload}>{t('administration.refresh')}</Action>
          </div>
        }
      />
      {secret ? (
        <div className="space-y-2">
          <p>{t('administration.tokenSecret')}</p>
          <p className="break-all font-mono">{secret}</p>
          <Action onPress={() => setSecret('')}>{t('administration.confirm')}</Action>
        </div>
      ) : null}
      <RemoteRegion {...state}>
        <DataTable
          label={t('administration.tokens')}
          columns={columns}
          rows={state.value ?? []}
          emptyContent={t('administration.empty')}
        />
      </RemoteRegion>
    </Page>
  );
}

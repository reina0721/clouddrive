'use client';
import { useEffect, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField, TextField, SelectField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useConnections, useFiles } from '../../../src/files/runtime';
import { FilesError, type FileListing } from '../../../src/files/model';
import type {
  ConnectionIssued,
  ConnectionListing,
  FileConnection,
} from '../../../src/files/connections';

export function CreateConnectionDialog({
  policy,
  onClose,
  onIssued,
}: Readonly<{
  policy: ConnectionListing;
  onClose(): void;
  onIssued(value: ConnectionIssued): void;
}>) {
  const port = useConnections(),
    files = useFiles();
  const { t } = useFrontendTranslation();
  const [name, setName] = useState(''),
    [parent, setParent] = useState('');
  const [readOnly, setReadOnly] = useState(false),
    [block, setBlock] = useState(true);
  const [age, setAge] = useState(String(policy.defaultAgeSeconds));
  const [directory, setDirectory] = useState<FileListing>(),
    [failure, setFailure] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void files
      .list(
        { parent, category: '', search: '', trash: false, sort: 'name', desc: false },
        controller.signal,
      )
      .then((value) => {
        if (!controller.signal.aborted) setDirectory(value);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
      });
    return () => controller.abort();
  }, [files, parent, retry, t]);
  function open(id: string) {
    setDirectory(undefined);
    setFailure('');
    setParent(id);
    setRetry((value) => value + 1);
  }
  const ages = [
    ...new Set(
      [86400, 604800, policy.defaultAgeSeconds, policy.maxAgeSeconds].filter(
        (value) => value <= policy.maxAgeSeconds,
      ),
    ),
  ].sort((a, b) => a - b);
  return (
    <DialogSurface
      triggerLabel={t('files.connections.create')}
      title={t('files.connections.create')}
      description={t('files.connections.createHint')}
      cancelLabel={t('files.cancel')}
      confirmLabel={t('files.create')}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      confirmDisabled={!name.trim() || !directory}
      failureMessage={failure}
      onConfirm={async () => {
        try {
          const issued = await port.create({
            name,
            rootId: parent,
            readOnly,
            blockSystemFiles: block,
            expiresAt: new Date(Date.now() + Number(age) * 1000).toISOString(),
          });
          onIssued(issued);
        } catch (error) {
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
          throw error;
        }
      }}
    >
      <div className="space-y-5">
        <TextField
          label={t('files.connections.name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
        <section
          className="rounded-control border border-border p-3"
          aria-label={t('files.connections.root')}
        >
          <h2 className="font-semibold">{t('files.connections.root')}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Action variant="secondary" onPress={() => open('')}>
              /
            </Action>
            {directory?.breadcrumbs.map((entry) => (
              <Action key={entry.id} variant="secondary" onPress={() => open(entry.id)}>
                {entry.name}
              </Action>
            ))}
          </div>
          <p className="my-3 break-words text-sm">
            {t('files.connections.selectedRoot')}: /
            {directory?.breadcrumbs.map((entry) => entry.name).join('/')}
          </p>
          {failure ? (
            <p role="alert" className="text-danger">
              {failure}
            </p>
          ) : null}
          {!directory ? (
            <Action variant="secondary" onPress={() => open(parent)}>
              {t('files.refresh')}
            </Action>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-auto">
              {directory.items
                .filter((entry) => entry.kind === 'folder')
                .map((entry) => (
                  <li key={entry.id}>
                    <Action variant="secondary" onPress={() => open(entry.id)}>
                      {entry.name}/
                    </Action>
                  </li>
                ))}
            </ul>
          )}
        </section>
        <CheckboxField
          label={t('files.connections.readOnly')}
          checked={readOnly}
          onCheckedChange={setReadOnly}
        />
        <CheckboxField
          label={t('files.connections.blockSystem')}
          checked={block}
          onCheckedChange={setBlock}
        />
        <SelectField
          label={t('files.connections.age')}
          value={age}
          options={ages.map((value) => ({
            value: String(value),
            label: t('files.connections.days', { count: value / 86400 }),
          }))}
          onValueChange={setAge}
        />
        <p className="text-sm text-ink-muted">{t('files.connections.proxyHint')}</p>
      </div>
    </DialogSurface>
  );
}

export type ConnectionAction = 'rename' | 'policy' | 'disable' | 'enable' | 'revoke' | 'rotate';
export function ChangeConnectionDialog({
  connection,
  action,
  onClose,
  onChanged,
  onIssued,
}: Readonly<{
  connection: FileConnection;
  action: ConnectionAction;
  onClose(): void;
  onChanged(): void;
  onIssued(value: ConnectionIssued): void;
}>) {
  const port = useConnections(),
    { t } = useFrontendTranslation();
  const [current, setCurrent] = useState(connection),
    [name, setName] = useState(connection.name);
  const [readOnly, setReadOnly] = useState(connection.readOnly),
    [block, setBlock] = useState(connection.blockSystemFiles);
  const [failure, setFailure] = useState(''),
    [refreshing, setRefreshing] = useState(false);
  return (
    <DialogSurface
      triggerLabel={t(`files.connections.actions.${action}`)}
      title={t(`files.connections.actions.${action}`)}
      description={t(`files.connections.actionHints.${action}`)}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      cancelLabel={t('files.cancel')}
      confirmLabel={t('files.confirm')}
      confirmDisabled={refreshing || (action === 'rename' && !name.trim())}
      failureMessage={failure}
      onConfirm={async () => {
        try {
          if (action === 'rename') await port.update(current, { name });
          else if (action === 'policy')
            await port.update(current, { readOnly, blockSystemFiles: block });
          else if (action === 'rotate') onIssued(await port.rotate(current));
          else
            await port.setState(
              current,
              action === 'enable' ? 'active' : action === 'disable' ? 'disabled' : 'revoked',
            );
          onChanged();
        } catch (error) {
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
          throw error;
        }
      }}
    >
      <div className="space-y-4">
        <p className="break-words font-semibold">{connection.name}</p>
        {action === 'rename' ? (
          <TextField
            label={t('files.connections.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        ) : null}
        {action === 'policy' ? (
          <>
            <CheckboxField
              label={t('files.connections.readOnly')}
              checked={readOnly}
              onCheckedChange={setReadOnly}
            />
            <CheckboxField
              label={t('files.connections.blockSystem')}
              checked={block}
              onCheckedChange={setBlock}
            />
          </>
        ) : null}
        {failure ? (
          <>
            <p role="alert" className="text-danger">
              {failure}
            </p>
            <Action
              variant="secondary"
              disabled={refreshing}
              onPress={() => {
                setRefreshing(true);
                void port
                  .read(current)
                  .then((value) => {
                    setCurrent(value);
                    setFailure('');
                  })
                  .catch((error: unknown) =>
                    setFailure(
                      t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
                    ),
                  )
                  .finally(() => setRefreshing(false));
              }}
            >
              {t('files.connections.readLatest')}
            </Action>
            <p className="text-sm text-ink-muted">{t('files.connections.draftKept')}</p>
          </>
        ) : null}
      </div>
    </DialogSurface>
  );
}

export function IssuedConnectionDialog({
  value,
  onClose,
}: Readonly<{ value: ConnectionIssued; onClose(): void }>) {
  const port = useConnections(),
    { t } = useFrontendTranslation(),
    [notice, setNotice] = useState('');
  function copy(action: () => Promise<void>) {
    setNotice('');
    void action()
      .then(() => setNotice(t('files.connections.copied')))
      .catch((error: unknown) =>
        setNotice(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`)),
      );
  }
  return (
    <DialogSurface
      triggerLabel={t('files.connections.credentials')}
      title={t('files.connections.credentials')}
      description={t('files.connections.oneTime')}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      cancelLabel={t('files.close')}
    >
      <dl className="space-y-5">
        {[
          {
            label: t('files.connections.endpoint'),
            text: port.endpoint(value),
            action: () => port.copyEndpoint(value),
          },
          {
            label: t('files.connections.username'),
            text: value.id,
            action: () => port.copyUsername(value),
          },
          {
            label: t('files.connections.password'),
            text: value.password,
            action: () => port.copyPassword(value),
          },
        ].map((field) => (
          <div key={field.label}>
            <dt className="mb-1 font-semibold">{field.label}</dt>
            <dd className="space-y-2">
              <code className="block select-all break-all rounded-control bg-surface-muted p-3">
                {field.text}
              </code>
              <Action variant="secondary" onPress={() => copy(field.action)}>
                {t('files.connections.copyField', { field: field.label })}
              </Action>
            </dd>
          </div>
        ))}
      </dl>
      {notice ? (
        <p role="status" className="mt-4">
          {notice}
        </p>
      ) : null}
    </DialogSurface>
  );
}

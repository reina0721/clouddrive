'use client';
import { useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { useFiles } from '../../../src/files/runtime';
import { FilesError } from '../../../src/files/model';
import {
  deniedSharePermissions,
  readOnlySharePermissions,
  maxShareAudienceRules,
  type SharePermissions,
  type ShareAudience,
} from '../../../src/files/sharing';
import type { AudienceKind, AudienceTarget } from '../../../src/files/access';
import { SharePermissionFields } from './share-settings-fields';
import { shareAudienceChoice, simpleShareAudience } from './share-audience-choice';

/** 常用访问范围先做选择，只有明确选择自定义时才展开完整规则。 */
export function ShareAudienceChoiceFields({
  value,
  onChange,
  rootKind = 'folder',
}: {
  value: ShareAudience;
  onChange: (value: ShareAudience) => void;
  rootKind?: 'file' | 'folder';
}) {
  const { t } = useFrontendTranslation();
  const [custom, setCustom] = useState(false);
  const choice = custom ? 'custom' : shareAudienceChoice(value);
  return (
    <div className="space-y-3">
      <SelectField
        label={t('files.collaboration.audienceChoice')}
        value={choice}
        options={(['anyone', 'signed-in', 'custom'] as const).map((mode) => ({
          value: mode,
          label: t(`files.collaboration.audiences.${mode}`),
        }))}
        onValueChange={(mode) => {
          setCustom(mode === 'custom');
          if (mode === 'anyone' || mode === 'signed-in') onChange(simpleShareAudience(mode));
        }}
      />
      <p className="text-sm text-ink-muted">{t(`files.collaboration.audienceHints.${choice}`)}</p>
      {choice === 'custom' ? (
        <ShareAudienceFields value={value} onChange={onChange} rootKind={rootKind} />
      ) : null}
    </div>
  );
}

export function AudienceTargetPicker({
  onSelect,
  kind: fixedKind,
}: {
  onSelect: (kind: AudienceKind, target: AudienceTarget) => void;
  kind?: AudienceKind;
}) {
  const port = useFiles(),
    { t } = useFrontendTranslation();
  const [kind, setKind] = useState<AudienceKind>('account'),
    [key, setKey] = useState(''),
    [target, setTarget] = useState<AudienceTarget>(),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const cancel = () => {
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
  };
  const selectedKind = fixedKind ?? kind;
  return (
    <section className="space-y-3">
      {!fixedKind ? (
        <SelectField
          label={t('files.access.kind')}
          value={kind}
          onValueChange={(value) => {
            cancel();
            setKind(value as AudienceKind);
            setTarget(undefined);
            setKey('');
          }}
          options={(['account', 'role'] as const).map((value) => ({
            value,
            label: t('files.access.' + value),
          }))}
        />
      ) : null}
      <TextField
        label={t('files.access.' + (selectedKind === 'account' ? 'accountKey' : 'roleKey'))}
        hint={t('files.access.lookupHint')}
        value={key}
        onChange={(event) => {
          cancel();
          setKey(event.target.value);
          setTarget(undefined);
          setFailure('');
        }}
      />
      <Action
        variant="secondary"
        disabled={busy || !key.trim()}
        onPress={() => {
          cancel();
          const controller = new AbortController();
          pending.current = controller;
          setBusy(true);
          setTarget(undefined);
          setFailure('');
          void port.access
            .lookup(selectedKind, key, controller.signal)
            .then((value) => {
              if (!controller.signal.aborted) setTarget(value);
            })
            .catch((error: unknown) => {
              if (!controller.signal.aborted)
                setFailure(
                  t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable')),
                );
            })
            .finally(() => {
              if (!controller.signal.aborted) setBusy(false);
            });
        }}
      >
        {t('files.access.lookup')}
      </Action>
      {failure ? (
        <p role="alert" className="text-sm text-danger">
          {failure}
        </p>
      ) : null}
      {target ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="break-words text-sm">
            {t('files.access.found', { name: target.label })}
          </p>
          <Action
            variant="secondary"
            onPress={() => {
              onSelect(selectedKind, target);
              setTarget(undefined);
            }}
          >
            {t('files.access.select')}
          </Action>
        </div>
      ) : null}
    </section>
  );
}

export function PermissionOverride({
  label,
  value,
  onChange,
  allowInherit,
  rootKind = 'folder',
  policyScope = 'share-root',
}: {
  label: string;
  value: SharePermissions | null;
  onChange: (value: SharePermissions | null) => void;
  allowInherit: boolean;
  rootKind?: 'file' | 'folder';
  policyScope?: 'share-root' | 'entry';
}) {
  const { t } = useFrontendTranslation();
  const mode = value === null ? 'inherit' : Object.values(value).some(Boolean) ? 'allow' : 'deny';
  return (
    <fieldset className="min-w-0 max-w-full space-y-3 break-all rounded-panel border border-border p-3">
      <legend className="max-w-full break-all px-1 text-sm font-semibold">{label}</legend>
      <SelectField
        label={label}
        value={mode}
        onValueChange={(next) =>
          onChange(
            next === 'inherit'
              ? null
              : next === 'deny'
                ? { ...deniedSharePermissions }
                : { ...readOnlySharePermissions },
          )
        }
        options={[
          ...(allowInherit ? [{ value: 'inherit', label: t('files.access.inheritDefault') }] : []),
          { value: 'deny', label: t('files.access.deny') },
          { value: 'allow', label: t('files.access.allow') },
        ]}
      />
      {mode === 'allow' && value ? (
        <SharePermissionFields
          value={value}
          onChange={onChange}
          rootKind={rootKind}
          policyScope={policyScope}
        />
      ) : null}
    </fieldset>
  );
}

export function ShareAudienceFields({
  value,
  onChange,
  rootKind = 'folder',
  policyScope = 'share-root',
}: {
  value: ShareAudience;
  onChange: (value: ShareAudience) => void;
  rootKind?: 'file' | 'folder';
  policyScope?: 'share-root' | 'entry';
}) {
  const { t } = useFrontendTranslation();
  const [failure, setFailure] = useState('');
  return (
    <section className="min-w-0 space-y-4" aria-label={t('files.access.audience')}>
      <h3 className="font-semibold">{t('files.access.audience')}</h3>
      <p className="text-sm text-ink-muted">{t('files.access.audienceHint')}</p>
      <PermissionOverride
        label={t('files.access.anonymous')}
        value={value.anonymous}
        onChange={(anonymous) => onChange({ ...value, anonymous })}
        allowInherit
        rootKind={rootKind}
        policyScope={policyScope}
      />
      <PermissionOverride
        label={t('files.access.authenticated')}
        value={value.authenticated}
        onChange={(authenticated) => onChange({ ...value, authenticated })}
        allowInherit
        rootKind={rootKind}
        policyScope={policyScope}
      />
      {(['accounts', 'roles'] as const).map((group) => (
        <section
          key={group}
          className="space-y-3"
          aria-label={t('files.access.' + (group === 'accounts' ? 'accountRules' : 'roleRules'))}
        >
          <h4 className="text-sm font-semibold">
            {t('files.access.' + (group === 'accounts' ? 'accountRules' : 'roleRules'))}
          </h4>
          {value[group].map((rule, index) => (
            <div key={rule.subjectId} className="space-y-2">
              <PermissionOverride
                label={(rule.label || t('files.access.unavailable')) + ' · ' + String(index + 1)}
                value={rule.permissions}
                onChange={(permissions) => {
                  if (permissions)
                    onChange({
                      ...value,
                      [group]: value[group].map((item) =>
                        item.subjectId === rule.subjectId ? { ...item, permissions } : item,
                      ),
                    });
                }}
                allowInherit={false}
                rootKind={rootKind}
                policyScope={policyScope}
              />
              <Action
                variant="quiet"
                onPress={() =>
                  onChange({
                    ...value,
                    [group]: value[group].filter((item) => item.subjectId !== rule.subjectId),
                  })
                }
              >
                {t('files.access.remove')}
              </Action>
            </div>
          ))}
        </section>
      ))}
      <p className="text-sm text-ink-muted">
        {t('files.access.limit', { count: maxShareAudienceRules })}
      </p>
      {value.accounts.length + value.roles.length < maxShareAudienceRules ? (
        <AudienceTargetPicker
          onSelect={(kind, target) => {
            const group = kind === 'account' ? 'accounts' : 'roles';
            if (value[group].some((rule) => rule.subjectId === target.id)) {
              setFailure(t('files.access.duplicate'));
              return;
            }
            setFailure('');
            onChange({
              ...value,
              [group]: [
                ...value[group],
                {
                  subjectId: target.id,
                  label: target.label,
                  permissions: { ...readOnlySharePermissions },
                },
              ],
            });
          }}
        />
      ) : null}
      {failure ? (
        <p role="alert" className="text-sm text-danger">
          {failure}
        </p>
      ) : null}
      <p className="text-sm text-ink-muted">{t('files.access.precedence')}</p>
    </section>
  );
}

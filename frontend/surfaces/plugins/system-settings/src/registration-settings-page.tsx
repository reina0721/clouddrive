'use client';
import { formatDate } from '@clouddrive/i18n';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import type { Preferences } from '@clouddrive/surface/preferences-model';
import { useState } from 'react';
import {
  FoundationForm,
  FoundationControlledField,
  useFoundationForm,
} from '@clouddrive/form-foundation';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { FormActions } from '@clouddrive/surface-foundation/form-actions';
import { SelectField, SwitchField } from '@clouddrive/ui-adapter/form-field';
import { Action } from '@clouddrive/ui-adapter/action';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { useRegisterDirtySource } from '@clouddrive/plugin-framework/leave-confirm';
import {
  IdentityError,
  useIdentityPort,
  registrationRestrictedPermissions,
  type RegistrationSettings,
  type RegistrationSettingsInput,
  type DirectoryRole,
} from '@clouddrive/surface/identity/runtime';
import { useIdentityQuery } from '../../../src/identity/use-query';
import {
  IdentityModeNotice,
  IdentityQueryState,
  IdentityMutationError,
} from '../../../src/identity/query-state';

function SettingsForm({
  settings,
  roles,
  allowed,
}: Readonly<{
  settings: RegistrationSettings;
  roles: readonly DirectoryRole[];
  allowed: boolean;
}>) {
  const { t, locale } = useFrontendTranslation();
  const region = usePreferencesPort<Preferences>().getSnapshot().localeRegion;
  const port = useIdentityPort();
  const { notify } = useFeedback();
  const [baseline, setBaseline] = useState(settings);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<IdentityError | null>(null);
  const [confirmation, setConfirmation] = useState<RegistrationSettingsInput | null>(null);
  const form = useFoundationForm<RegistrationSettingsInput>({
    schema: () =>
      import('../../../src/identity/model').then(
        (module) => module.registrationSettingsInputSchema,
      ),
    defaultValues: {
      enabled: settings.enabled,
      defaultRoleId: settings.defaultRoleId,
      version: settings.version,
    },
  });
  useRegisterDirtySource({
    pageId: 'system-settings.registration',
    message: () => t('identityProduct.unsaved'),
    isDirty: () => form.isDirty,
    isSubmitting: () => pending,
  });
  async function reload() {
    if (pending) return;
    setPending(true);
    try {
      const latest = await port.registrationSettings();
      setBaseline(latest);
      form.reset({
        enabled: latest.enabled,
        defaultRoleId: latest.defaultRoleId,
        version: latest.version,
      });
      setFailure(null);
    } catch (error) {
      setFailure(error instanceof IdentityError ? error : new IdentityError('unavailable'));
    } finally {
      setPending(false);
    }
  }
  async function save() {
    if (!confirmation || pending) return;
    setPending(true);
    try {
      const saved = await port.updateRegistrationSettings(confirmation);
      setBaseline(saved);
      form.reset({
        enabled: saved.enabled,
        defaultRoleId: saved.defaultRoleId,
        version: saved.version,
      });
      setConfirmation(null);
      setFailure(null);
      notify({ title: t('systemSettings.saved'), tone: 'success' });
    } catch (error) {
      const problem = error instanceof IdentityError ? error : new IdentityError('unavailable');
      setFailure(problem);
      throw problem;
    } finally {
      setPending(false);
    }
  }
  return (
    <Section
      title={t('systemSettings.title')}
      description={t('systemSettings.description')}
      action={
        <div className="flex items-center gap-2">
          <StatusPill tone={baseline.enabled ? 'success' : 'neutral'}>
            {t(baseline.enabled ? 'systemSettings.open' : 'systemSettings.closed')}
          </StatusPill>
          <span className="text-xs tabular-nums text-ink-muted">
            {formatDate(
              locale,
              baseline.updatedAt,
              region.timeZone === 'auto' ? {} : { timeZone: region.timeZone },
            )}
          </span>
        </div>
      }
    >
      <FoundationForm
        form={form}
        className="grid gap-6 p-5 sm:p-6"
        onSubmit={(values) => {
          setFailure(null);
          setConfirmation(values);
        }}
      >
        {!allowed ? <p className="text-sm text-ink-muted">{t('systemSettings.readonly')}</p> : null}
        <IdentityMutationError
          error={failure}
          reload={() => {
            void reload();
          }}
        />
        <FoundationControlledField form={form} name="enabled">
          {(field) => (
            <div className="max-w-xl">
              <SwitchField
                label={t('systemSettings.enabled')}
                description={t('systemSettings.enabledHint')}
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!allowed || pending}
              />
            </div>
          )}
        </FoundationControlledField>
        <FoundationControlledField form={form} name="defaultRoleId">
          {(field) => (
            <div className="grid max-w-xl min-w-0 gap-3">
              <SelectField
                label={t('systemSettings.role')}
                hint={t('systemSettings.roleHint')}
                value={field.value}
                onValueChange={field.onChange}
                disabled={!allowed || pending}
                options={roles.map((role) => ({
                  value: role.id,
                  label: ['administrator', 'operator', 'viewer'].includes(role.id)
                    ? t(`identityProduct.roleNames.${role.id}`)
                    : role.name,
                  disabled: role.permissions.some((permission) =>
                    registrationRestrictedPermissions.some(
                      (restricted) => restricted === permission,
                    ),
                  ),
                }))}
                {...(form.hasError('defaultRoleId') ? { error: t('systemSettings.invalid') } : {})}
              />
              <div className="rounded-control border border-border/60 bg-surface-muted/30 p-3 text-xs text-ink-muted">
                <p className="font-semibold text-ink">{t('systemSettings.permissions')}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {roles
                    .find((role) => role.id === field.value)
                    ?.permissions.map((permission) => (
                      <span
                        key={permission}
                        className="rounded bg-surface px-2 py-0.5 border border-border/80 text-ink-muted"
                      >
                        {t(`management.permissions.${permission}`)}
                      </span>
                    ))}
                </div>
                {!roles.find((role) => role.id === field.value)?.permissions.length ? (
                  <p className="mt-1">{t('systemSettings.noPermissions')}</p>
                ) : null}
              </div>
            </div>
          )}
        </FoundationControlledField>
        <FormActions
          primary={
            <Action type="submit" disabled={!allowed || !form.isDirty || pending}>
              {t('systemSettings.save')}
            </Action>
          }
          secondary={
            <Action
              variant="quiet"
              disabled={pending}
              onPress={() => {
                form.reset({
                  enabled: baseline.enabled,
                  defaultRoleId: baseline.defaultRoleId,
                  version: baseline.version,
                });
                setFailure(null);
              }}
            >
              {t('systemSettings.reset')}
            </Action>
          }
        />
      </FoundationForm>
      <ConfirmDialog
        triggerLabel=""
        title={t('systemSettings.confirm')}
        description={t('systemSettings.description')}
        impact={t('systemSettings.impact')}
        cancelLabel={t('systemSettings.cancel')}
        confirmLabel={t('systemSettings.save')}
        failureMessage={t('systemSettings.failure')}
        isOpen={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        onConfirm={save}
      />
    </Section>
  );
}
export function RegistrationSettingsPage() {
  const { t } = useFrontendTranslation();
  const port = useIdentityPort();
  const query = useIdentityQuery('registration-settings', async (service) => {
    const access = await service.access();
    if (!access.permissions.includes('settings.read')) throw new IdentityError('forbidden');
    const [settings, roles] = await Promise.all([service.registrationSettings(), service.roles()]);
    return { settings, roles, allowed: access.permissions.includes('settings.update') };
  });
  return (
    <Page>
      <PageHeader title={t('systemSettings.title')} description={t('systemSettings.description')} />
      <IdentityModeNotice mode={port.mode} />
      {query.error || !query.data ? (
        <IdentityQueryState error={query.error} retry={query.reload} />
      ) : (
        <SettingsForm
          key={port.currentUserId()}
          settings={query.data.settings}
          roles={query.data.roles}
          allowed={query.data.allowed}
        />
      )}
    </Page>
  );
}

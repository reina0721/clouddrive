'use client';
import { useRef, useState, useEffect } from 'react';
import { useFrontendTranslation, formatDate, formatTimeOfDay } from '@clouddrive/i18n';
import {
  FoundationForm,
  FoundationControlledField,
  useFoundationForm,
} from '@clouddrive/form-foundation';
import { Section } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { PasswordField } from '@clouddrive/ui-adapter/form-field';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { LogOut, Monitor, RefreshCw } from '../../../src/action-icons';
import {
  useAccountSecurityPort,
  IdentityError,
  type AccountSession,
} from '@clouddrive/surface/identity/runtime';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import { useRegisterDirtySource } from '@clouddrive/plugin-framework/leave-confirm';
import type { Preferences } from '@clouddrive/surface/preferences-model';
import { IdentityQueryState, IdentityMutationError } from '../../../src/identity/query-state';

export function AccountSecurity() {
  const port = useAccountSecurityPort();
  const { t, locale } = useFrontendTranslation();
  const { notify } = useFeedback();
  const region = usePreferencesPort<Preferences>().getSnapshot().localeRegion;
  const [sessions, setSessions] = useState<readonly AccountSession[] | null>(null);
  const [error, setError] = useState<IdentityError | null>(null);
  const [passwordError, setPasswordError] = useState<IdentityError | null>(null);
  const currentPasswordRef = useRef<HTMLInputElement | null>(null);
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<'others' | AccountSession | null>(null);
  const lock = useRef(false);
  const form = useFoundationForm<{ currentPassword: string; newPassword: string }>({
    schema: async () =>
      (await import('../../../src/identity/security-schema')).changePasswordSchema,
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  useRegisterDirtySource({
    pageId: 'account.security',
    message: () => t('identityProduct.unsaved'),
    isDirty: () => form.isDirty,
    isSubmitting: () => pending || form.isSubmitting,
  });
  async function changePassword(values: { currentPassword: string; newPassword: string }) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setPasswordError(null);
    try {
      await port.changePassword(values.currentPassword, values.newPassword);
      form.reset({ currentPassword: '', newPassword: '' });
      notify({ title: t('account.securitySaved'), tone: 'success' });
    } catch (error) {
      const failure = error instanceof IdentityError ? error : new IdentityError('unavailable');
      setPasswordError(failure);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  useEffect(() => {
    if (
      !pending &&
      !form.isSubmitting &&
      passwordError?.fields.some((field) => field.field === 'password')
    )
      currentPasswordRef.current?.focus();
  }, [passwordError, pending, form.isSubmitting]);
  useEffect(() => {
    let active = true;
    port
      .sessions()
      .then((items) => {
        if (active) {
          setSessions(items);
          setError(null);
        }
      })
      .catch((error: unknown) => {
        if (active)
          setError(error instanceof IdentityError ? error : new IdentityError('unavailable'));
      });
    return () => {
      active = false;
    };
  }, [port, revision]);
  const timestamp = (value: string) =>
    formatDate(locale, value, region.timeZone === 'auto' ? {} : { timeZone: region.timeZone }) +
    ' · ' +
    formatTimeOfDay(locale, region, value);
  async function commit() {
    if (!confirmation || lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    try {
      if (confirmation === 'others') await port.revokeOtherSessions();
      else await port.revokeSession(confirmation.id);
      setConfirmation(null);
      setRevision((value) => value + 1);
      notify({ title: t('account.securitySaved'), tone: 'success' });
    } catch (error) {
      setError(error instanceof IdentityError ? error : new IdentityError('unavailable'));
      throw error;
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <Section
        appearance="outlined"
        title={t('account.security')}
        description={t('account.passwordImpact')}
      >
        <div className="grid min-w-0 gap-4 p-5">
          <IdentityMutationError error={passwordError} />
          <FoundationForm
            form={form}
            className="grid w-full min-w-0 max-w-2xl gap-4"
            onSubmit={changePassword}
          >
            <FoundationControlledField form={form} name="currentPassword">
              {(field) => (
                <PasswordField
                  label={t('account.currentPassword')}
                  purpose="current"
                  showLabel={t('account.showPassword')}
                  hideLabel={t('account.hidePassword')}
                  value={field.value}
                  name={field.name}
                  onBlur={field.onBlur}
                  ref={(instance) => {
                    currentPasswordRef.current = instance;
                    field.ref(instance);
                  }}
                  onChange={(event) => {
                    setPasswordError(null);
                    field.onChange(event.target.value);
                  }}
                  disabled={pending || form.isSubmitting}
                  {...(form.hasError('currentPassword') ||
                  passwordError?.fields.some((field) => field.field === 'password')
                    ? { error: t('account.currentPasswordInvalid') }
                    : {})}
                />
              )}
            </FoundationControlledField>
            <FoundationControlledField form={form} name="newPassword">
              {(field) => (
                <PasswordField
                  label={t('account.newPassword')}
                  purpose="new"
                  hint={t('account.passwordHint')}
                  showLabel={t('account.showPassword')}
                  hideLabel={t('account.hidePassword')}
                  value={field.value}
                  name={field.name}
                  onBlur={field.onBlur}
                  ref={(instance) => {
                    field.ref(instance);
                  }}
                  onChange={(event) => field.onChange(event.target.value)}
                  disabled={pending || form.isSubmitting}
                  {...(form.hasError('newPassword') ? { error: t('account.passwordInvalid') } : {})}
                />
              )}
            </FoundationControlledField>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Action
                variant="quiet"
                disabled={pending || form.isSubmitting}
                onPress={() => {
                  form.reset({ currentPassword: '', newPassword: '' });
                  setPasswordError(null);
                }}
              >
                {t('account.clearPassword')}
              </Action>
              <Action
                type="submit"
                disabled={pending || form.isSubmitting || !form.isDirty}
                loading={form.isSubmitting}
              >
                {t('account.changePassword')}
              </Action>
            </div>
          </FoundationForm>
        </div>
      </Section>
      <Section
        appearance="outlined"
        title={t('account.sessions')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <IconAction
              label={t('identityProduct.refresh')}
              tooltip
              disabled={pending || form.isSubmitting}
              onPress={() => setRevision((value) => value + 1)}
            >
              <RefreshCw className="size-4" />
            </IconAction>
            <Action
              variant="secondary"
              size="sm"
              disabled={
                pending || form.isSubmitting || !sessions?.some((session) => !session.current)
              }
              leadingIcon={<LogOut className="size-3.5" />}
              onPress={() => setConfirmation('others')}
            >
              {t('account.revokeOthers')}
            </Action>
          </div>
        }
      >
        <div className="grid min-w-0 gap-4 p-5 sm:p-6">
          <IdentityMutationError error={error} />
          {sessions && !sessions.some((session) => !session.current) ? (
            <p className="text-sm text-ink-muted">{t('account.noOtherSessions')}</p>
          ) : null}
          {!sessions ? (
            <IdentityQueryState error={error} retry={() => setRevision((value) => value + 1)} />
          ) : (
            <ul data-reveal-items className="divide-y divide-border">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 grid gap-1">
                    <div className="flex items-center gap-2">
                      <Monitor className="size-4 text-ink-muted shrink-0" />
                      <span className="font-semibold text-ink">{session.device}</span>
                      {session.current ? (
                        <StatusPill tone="success">{t('account.currentSession')}</StatusPill>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted tabular-nums">
                      <span>
                        {t('account.lastActive')}: {timestamp(session.lastActiveAt ?? '')}
                      </span>
                      <span>·</span>
                      <span>
                        {t('account.created')}: {timestamp(session.createdAt ?? '')}
                      </span>
                      <span>·</span>
                      <span>
                        {t('account.expires')}: {timestamp(session.expiresAt ?? '')}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 shrink-0 sm:mt-0">
                    <Action
                      variant="quiet"
                      size="sm"
                      disabled={pending || form.isSubmitting}
                      onPress={() => setConfirmation(session)}
                    >
                      {t(session.current ? 'account.signOutCurrent' : 'account.revoke')}
                    </Action>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ConfirmDialog
          triggerLabel=""
          title={t(
            typeof confirmation === 'object' && confirmation?.current
              ? 'account.signOutCurrent'
              : 'account.revoke',
          )}
          description={
            typeof confirmation === 'object'
              ? (confirmation?.device ?? '')
              : t('account.securityDescription')
          }
          impact={t(
            typeof confirmation === 'object' && confirmation?.current
              ? 'account.currentSessionImpact'
              : 'account.revokeImpact',
          )}
          cancelLabel={t('account.cancel')}
          confirmLabel={t('account.confirm')}
          failureMessage={t('account.securityFailure')}
          isOpen={confirmation !== null}
          onOpenChange={(open) => {
            if (!open) setConfirmation(null);
          }}
          onConfirm={commit}
        />
      </Section>
    </>
  );
}

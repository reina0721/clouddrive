'use client';
import { useRef, useState } from 'react';
import {
  FoundationForm,
  FoundationControlledField,
  useFoundationForm,
} from '@clouddrive/form-foundation';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useRegisterDirtySource } from '@clouddrive/plugin-framework/leave-confirm';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import { route, usePluginNavigation } from '@clouddrive/plugin-framework/plugin';
import type { Preferences } from '@clouddrive/surface/preferences-model';
import { Section } from '@clouddrive/surface-foundation/layout';
import { FormActions } from '@clouddrive/surface-foundation/form-actions';
import { Action } from '@clouddrive/ui-adapter/action';
import {
  TextField,
  CheckboxField,
  SelectField,
  PasswordField,
} from '@clouddrive/ui-adapter/form-field';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import type { CreateUserInput, DirectoryUser, DirectoryRole, IdentityAccess } from './model';
import { IdentityError } from './errors';
import { useIdentityPort } from './context';
import { IdentityMutationError } from './query-state';

export function UserForm({
  mode,
  user,
  roles,
  access,
  presentation = 'section',
  saveLabel,
  onSaved,
}: Readonly<{
  mode: 'create' | 'edit' | 'profile';
  user?: DirectoryUser;
  roles: readonly DirectoryRole[];
  access: IdentityAccess;
  presentation?: 'section' | 'embedded';
  saveLabel?: string;
  onSaved?: (user: DirectoryUser) => void;
}>) {
  const port = useIdentityPort();
  const { t } = useFrontendTranslation();
  const { navigate } = usePluginNavigation();
  const { notify } = useFeedback();
  const preferences = usePreferencesPort<Preferences>();
  const [baseline, setBaseline] = useState(user);
  const [failure, setFailure] = useState<IdentityError | null>(null);
  const [reloading, setReloading] = useState(false);
  const committed = useRef(false);
  const valuesFor = (record?: DirectoryUser): CreateUserInput => ({
    name: record?.name ?? '',
    email: record?.email ?? '',
    password: '',
    status: record?.status ?? 'active',
    roleIds: record?.roleIds ?? ['viewer'],
  });
  const [defaults] = useState(() => valuesFor(user));
  const allowed = access.permissions.includes(
    mode === 'create' ? 'users.create' : mode === 'profile' ? 'account.update' : 'users.update',
  );
  const form = useFoundationForm<CreateUserInput>({
    schema: async () =>
      mode === 'create'
        ? (await import('./model')).createUserSchema
        : (await import('./form-schema')).profileEditorSchema,
    defaultValues: defaults,
    interaction: allowed ? 'editable' : 'readonly',
    focusFirstError: preferences.getSnapshot().actionPreferences.focusFirstError,
  });
  const pageId =
    mode === 'profile'
      ? 'account'
      : mode === 'create'
        ? 'users.create'
        : `users.edit:${user?.id ?? ''}`;
  useRegisterDirtySource({
    pageId,
    message: () => t('identityProduct.unsaved'),
    isDirty: () => form.isDirty && !committed.current,
    isSubmitting: () => form.isSubmitting || reloading,
  });
  const busy = form.isSubmitting || reloading;
  const roleLabel = (role: DirectoryRole) =>
    ['administrator', 'operator', 'viewer'].includes(role.id)
      ? t(`identityProduct.roleNames.${role.id}`)
      : role.name;
  const change = () => {
    committed.current = false;
  };
  async function reload() {
    if (!baseline || busy) return;
    setReloading(true);
    setFailure(null);
    try {
      const latest = mode === 'profile' ? await port.me() : await port.read(baseline.id);
      setBaseline(latest);
      form.reset(valuesFor(latest));
      committed.current = false;
    } catch (error) {
      setFailure(error instanceof IdentityError ? error : new IdentityError('unavailable'));
    } finally {
      setReloading(false);
    }
  }
  async function submit(values: CreateUserInput) {
    if (!allowed) return;
    setFailure(null);
    try {
      const saved =
        mode === 'create'
          ? await port.create(values)
          : baseline
            ? mode === 'profile'
              ? await port.updateMe({
                  name: values.name,
                  email: values.email,
                  version: baseline.version,
                })
              : await port.update(baseline.id, {
                  name: values.name,
                  email: values.email,
                  version: baseline.version,
                })
            : null;
      if (!saved) throw new IdentityError('not-found');
      committed.current = true;
      setBaseline(saved);
      form.reset(valuesFor(saved));
      const title = t(
        mode === 'profile' ? 'identityProduct.profileSaved' : 'identityProduct.userSaved',
      );
      notify({ title, tone: 'success' });
      if (mode === 'create') navigate(route('users.detail', {}, { query: { id: saved.id } }));
      onSaved?.(saved);
    } catch (error) {
      setFailure(error instanceof IdentityError ? error : new IdentityError('unavailable'));
    }
  }
  const emailError = failure?.fields.some((issue) => issue.field === 'email')
    ? t('identityProduct.reasons.duplicate-email')
    : form.hasError('email')
      ? t('identityProduct.invalidEmail')
      : undefined;
  const resetAction = (
    <Action
      variant="quiet"
      disabled={busy}
      onPress={() => {
        form.reset(valuesFor(baseline));
        change();
        setFailure(null);
      }}
    >
      {t('identityProduct.reset')}
    </Action>
  );
  const saveAction = (
    <Action type="submit" disabled={busy || !allowed} loading={form.isSubmitting}>
      {saveLabel ?? t('identityProduct.save')}
    </Action>
  );
  const content = (
    <FoundationForm
      form={form}
      onSubmit={submit}
      className={presentation === 'embedded' ? 'grid gap-5' : 'grid gap-5 p-5'}
    >
      {!allowed ? <p className="text-sm text-ink-muted">{t('identityProduct.readonly')}</p> : null}
      <IdentityMutationError
        error={failure}
        reload={() => {
          void reload();
        }}
      />
      <div data-reveal-items className="grid gap-5 md:grid-cols-2">
        <FoundationControlledField form={form} name="name">
          {(field) => (
            <TextField
              label={t('identityProduct.name')}
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              ref={(instance) => {
                if (typeof field.ref === 'function') field.ref(instance);
                else if (field.ref) field.ref.current = instance;
              }}
              disabled={busy || !allowed}
              {...(form.hasError('name') ? { error: t('identityProduct.invalidName') } : {})}
              onChange={(event) => {
                change();
                field.onChange(event.target.value);
              }}
            />
          )}
        </FoundationControlledField>
        <FoundationControlledField form={form} name="email">
          {(field) => (
            <TextField
              label={t('identityProduct.email')}
              name={field.name}
              purpose="email"
              value={field.value}
              onBlur={field.onBlur}
              ref={(instance) => {
                if (typeof field.ref === 'function') field.ref(instance);
                else if (field.ref) field.ref.current = instance;
              }}
              disabled={busy || !allowed}
              {...(emailError ? { error: emailError } : {})}
              onChange={(event) => {
                change();
                field.onChange(event.target.value);
              }}
            />
          )}
        </FoundationControlledField>
      </div>
      {mode === 'create' ? (
        <>
          <FoundationControlledField form={form} name="password">
            {(field) => (
              <PasswordField
                label={t('identityProduct.password')}
                purpose="new"
                hint={t('identityProduct.passwordHint')}
                showLabel={t('identityProduct.showPassword')}
                hideLabel={t('identityProduct.hidePassword')}
                name={field.name}
                value={field.value}
                onBlur={field.onBlur}
                ref={(instance) => {
                  if (typeof field.ref === 'function') field.ref(instance);
                  else if (field.ref) field.ref.current = instance;
                }}
                disabled={busy || !allowed}
                {...(form.hasError('password')
                  ? { error: t('identityProduct.invalidPassword') }
                  : {})}
                onChange={(event) => {
                  change();
                  field.onChange(event.target.value);
                }}
              />
            )}
          </FoundationControlledField>
          <FoundationControlledField form={form} name="status">
            {(field) => (
              <SelectField
                label={t('identityProduct.status')}
                value={field.value}
                options={[
                  { value: 'active', label: t('identityProduct.active') },
                  { value: 'disabled', label: t('identityProduct.disabled') },
                ]}
                disabled={busy || !allowed || !access.permissions.includes('users.status')}
                onValueChange={(value) => {
                  if (value === 'active' || value === 'disabled') {
                    change();
                    field.onChange(value);
                  }
                }}
              />
            )}
          </FoundationControlledField>
          <FoundationControlledField form={form} name="roleIds">
            {(field) => (
              <fieldset className="grid gap-3">
                <legend className="mb-3 text-sm font-semibold text-ink">
                  {t('identityProduct.roles')}
                </legend>
                {!access.permissions.includes('users.roles') ? (
                  <p className="text-sm text-ink-muted">{t('identityProduct.roleLimit')}</p>
                ) : null}
                <div data-reveal-items className="grid gap-3 sm:grid-cols-3">
                  {roles.map((role) => (
                    <CheckboxField
                      key={role.id}
                      label={roleLabel(role)}
                      checked={field.value.includes(role.id)}
                      disabled={
                        busy ||
                        !allowed ||
                        (!access.permissions.includes('users.roles') && role.id !== 'viewer')
                      }
                      onCheckedChange={(checked) => {
                        change();
                        field.onChange(
                          checked
                            ? [...field.value, role.id]
                            : field.value.filter((id) => id !== role.id),
                        );
                      }}
                    />
                  ))}
                </div>
                {form.hasError('roleIds') ? (
                  <p role="alert" className="text-sm text-danger">
                    {t('identityProduct.invalidRoles')}
                  </p>
                ) : null}
              </fieldset>
            )}
          </FoundationControlledField>
        </>
      ) : null}
      {presentation === 'embedded' ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {resetAction}
          {saveAction}
        </div>
      ) : (
        <FormActions
          summary={busy ? t('identityProduct.saving') : undefined}
          secondary={resetAction}
          primary={saveAction}
        />
      )}
    </FoundationForm>
  );
  return presentation === 'embedded' ? (
    content
  ) : (
    <Section
      title={t(
        mode === 'profile'
          ? 'identityProduct.profileTitle'
          : mode === 'create'
            ? 'identityProduct.createTitle'
            : 'identityProduct.editTitle',
      )}
    >
      {content}
    </Section>
  );
}

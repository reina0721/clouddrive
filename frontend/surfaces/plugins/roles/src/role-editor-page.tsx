'use client';
import { useRef, useState } from 'react';
import {
  FoundationForm,
  FoundationControlledField,
  useFoundationForm,
} from '@clouddrive/form-foundation';
import { useFrontendTranslation, formatNumber } from '@clouddrive/i18n';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { FormActions } from '@clouddrive/surface-foundation/form-actions';
import { TextField, CheckboxField } from '@clouddrive/ui-adapter/form-field';
import { Action } from '@clouddrive/ui-adapter/action';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { route, RouteLink, usePluginNavigation } from '@clouddrive/plugin-framework/plugin';
import { useRegisterDirtySource } from '@clouddrive/plugin-framework/leave-confirm';
import {
  IdentityError,
  permissionCodes,
  defaultUserQuery,
  useIdentityPort,
  type DirectoryRole,
  type IdentityAccess,
  type RoleInput,
} from '@clouddrive/surface/identity/runtime';
import { useIdentityQuery } from '../../../src/identity/use-query';
import {
  IdentityModeNotice,
  IdentityQueryState,
  IdentityMutationError,
} from '../../../src/identity/query-state';
function RoleForm({
  role,
  access,
  members,
}: Readonly<{ role?: DirectoryRole; access: IdentityAccess; members: number | null }>) {
  const port = useIdentityPort();
  const { t, locale } = useFrontendTranslation();
  const { navigate } = usePluginNavigation();
  const { notify } = useFeedback();
  const committed = useRef(false);
  const [baseline, setBaseline] = useState(role);
  const [failure, setFailure] = useState<IdentityError | null>(null);
  const [confirmation, setConfirmation] = useState<RoleInput | null>(null);
  const [pending, setPending] = useState(false);
  const added =
    confirmation?.permissions.filter((permission) => !baseline?.permissions.includes(permission)) ??
    [];
  const removed =
    baseline?.permissions.filter((permission) => !confirmation?.permissions.includes(permission)) ??
    [];
  const allowed =
    access.permissions.includes(role ? 'roles.update' : 'roles.create') &&
    !role?.protected &&
    !access.user.roleIds.includes(role?.id ?? '');
  const defaults: RoleInput = {
    name: baseline?.name ?? '',
    permissions: baseline?.permissions ?? [],
  };
  const form = useFoundationForm<RoleInput>({
    schema: async () => (await import('../../../src/identity/model')).roleInputSchema,
    defaultValues: defaults,
    interaction: allowed ? 'editable' : 'readonly',
  });
  useRegisterDirtySource({
    pageId: `roles.edit:${role?.id ?? 'create'}`,
    message: () => t('identityProduct.unsaved'),
    isDirty: () => form.isDirty && !committed.current,
    isSubmitting: () => pending,
  });
  async function save() {
    if (!confirmation || !allowed || pending) return;
    setPending(true);
    setFailure(null);
    try {
      const saved = baseline
        ? await port.updateRole(baseline.id, { ...confirmation, version: baseline.version })
        : await port.createRole(confirmation);
      committed.current = true;
      setBaseline(saved);
      form.reset({ name: saved.name, permissions: saved.permissions });
      notify({ title: t('roles.saved'), tone: 'success' });
      navigate(route('roles.detail', {}, { query: { id: saved.id } }));
    } catch (error) {
      const failure = error instanceof IdentityError ? error : new IdentityError('unavailable');
      setFailure(failure);
      throw failure;
    } finally {
      setPending(false);
    }
  }
  async function reload() {
    if (!baseline || pending) return;
    setPending(true);
    try {
      const latest = await port.readRole(baseline.id);
      setBaseline(latest);
      form.reset({ name: latest.name, permissions: latest.permissions });
      setFailure(null);
    } catch (error) {
      setFailure(error instanceof IdentityError ? error : new IdentityError('unavailable'));
    } finally {
      setPending(false);
    }
  }
  return (
    <Section title={t(role ? 'roles.edit' : 'roles.create')} description={t('roles.impact')}>
      <FoundationForm
        form={form}
        onSubmit={(values) => {
          committed.current = false;
          setFailure(null);
          setConfirmation(values);
        }}
        className="grid gap-5 p-5"
      >
        {!allowed ? (
          <p className="text-sm text-ink-muted">
            {t(role?.protected ? 'roles.protected' : 'identityProduct.readonly')}
          </p>
        ) : null}
        <IdentityMutationError
          error={failure}
          reload={() => {
            void reload();
          }}
        />
        <FoundationControlledField form={form} name="name">
          {(field) => (
            <TextField
              label={t('roles.name')}
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              ref={(instance) => {
                field.ref(instance);
              }}
              disabled={!allowed || pending}
              onChange={(event) => field.onChange(event.target.value)}
              {...(form.hasError('name') ? { error: t('identityProduct.invalidName') } : {})}
            />
          )}
        </FoundationControlledField>
        <FoundationControlledField form={form} name="permissions">
          {(field) => (
            <fieldset className="grid gap-4">
              <legend className="mb-3 text-sm font-semibold">{t('roles.permissions')}</legend>
              {['users', 'roles', 'account', 'audit', 'settings'].map((resource) => (
                <div key={resource} className="grid gap-3">
                  <p className="text-sm font-semibold text-ink-muted">
                    {t(`management.resources.${resource}`)}
                  </p>
                  <div data-reveal-items className="grid gap-3 sm:grid-cols-2">
                    {permissionCodes
                      .filter((permission) => permission.startsWith(`${resource}.`))
                      .map((permission) => (
                        <CheckboxField
                          key={permission}
                          label={t(`management.permissions.${permission}`)}
                          checked={field.value.includes(permission)}
                          disabled={
                            !allowed ||
                            pending ||
                            (!access.permissions.includes(permission) &&
                              !field.value.includes(permission))
                          }
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, permission]
                                : field.value.filter((value) => value !== permission),
                            )
                          }
                        />
                      ))}
                  </div>
                </div>
              ))}
            </fieldset>
          )}
        </FoundationControlledField>
        <FormActions
          primary={
            <Action type="submit" disabled={!allowed || pending || !form.isDirty}>
              {t('identityProduct.save')}
            </Action>
          }
          secondary={
            <Action
              variant="quiet"
              disabled={pending}
              onPress={() => {
                form.reset(defaults);
                setFailure(null);
              }}
            >
              {t('identityProduct.reset')}
            </Action>
          }
        />
      </FoundationForm>
      <ConfirmDialog
        triggerLabel={t('identityProduct.save')}
        title={t('roles.confirm')}
        description={t('roles.impact')}
        impact={
          <div className="grid gap-3">
            <p>
              {confirmation?.name} ·{' '}
              {t('roles.permissionCount', {
                count: confirmation?.permissions.length ?? 0,
                value: formatNumber(locale, confirmation?.permissions.length ?? 0),
              })}
            </p>
            <p>
              {members === null
                ? t('roles.membersDenied')
                : t('roles.affectedMembers', {
                    count: members,
                    value: formatNumber(locale, members),
                  })}
            </p>
            <p>
              {t('roles.addedPermissions')}:{' '}
              {added.length
                ? added.map((permission) => t(`management.permissions.${permission}`)).join(' / ')
                : t('roles.noChanges')}
            </p>
            <p>
              {t('roles.removedPermissions')}:{' '}
              {removed.length
                ? removed.map((permission) => t(`management.permissions.${permission}`)).join(' / ')
                : t('roles.noChanges')}
            </p>
          </div>
        }
        cancelLabel={t('identityProduct.cancel')}
        confirmLabel={t('identityProduct.save')}
        failureMessage={
          failure ? t(`identityProduct.errors.${failure.code}`) : t('identityProduct.unknown')
        }
        isOpen={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        confirmDisabled={!allowed || pending}
        onConfirm={save}
      />
    </Section>
  );
}
export function RoleEditorPage({ id }: Readonly<{ id?: string }>) {
  const { t } = useFrontendTranslation();
  const port = useIdentityPort();
  const result = useIdentityQuery(`roles.editor:${id ?? 'create'}`, async (service) => {
    const { identifierSchema } = await import('../../../src/identity/model');
    const access = await service.access();
    if (!access.permissions.includes(id === undefined ? 'roles.create' : 'roles.update'))
      throw new IdentityError('forbidden');
    if (id !== undefined && !identifierSchema.safeParse(id).success)
      throw new IdentityError('not-found');
    const role = id === undefined ? undefined : await service.readRole(id);
    const members =
      role && access.permissions.includes('users.read')
        ? (await service.list({ ...defaultUserQuery, roleId: role.id, pageSize: 10 })).total
        : role
          ? null
          : 0;
    return { access, role, members };
  });
  return (
    <Page>
      <PageHeader
        title={t(id === undefined ? 'roles.create' : 'roles.edit')}
        description={t('roles.impact')}
        actions={<RouteLink target={route('roles')}>{t('roles.back')}</RouteLink>}
      />
      <IdentityModeNotice mode={port.mode} />
      {result.error || !result.data ? (
        <IdentityQueryState error={result.error} retry={result.reload} />
      ) : (
        <RoleForm
          key={id ?? 'create'}
          access={result.data.access}
          members={result.data.members}
          {...(result.data.role ? { role: result.data.role } : {})}
        />
      )}
    </Page>
  );
}

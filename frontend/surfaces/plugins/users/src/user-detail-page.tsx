'use client';
import { useState, useSyncExternalStore } from 'react';
import { formatDate, formatTimeOfDay, useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { CheckboxField } from '@clouddrive/ui-adapter/form-field';
import { Action } from '@clouddrive/ui-adapter/action';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { route, RouteLink } from '@clouddrive/plugin-framework/plugin';
import { useRegisterDirtySource } from '@clouddrive/plugin-framework/leave-confirm';
import { useWorkbenchPort } from '@clouddrive/plugin-framework/workbench';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import type { Preferences } from '@clouddrive/surface/preferences-model';
import {
  useIdentityPort,
  IdentityError,
  type DirectoryUser,
  type DirectoryRole,
  type IdentityAccess,
} from '@clouddrive/surface/identity/runtime';
import { useIdentityQuery } from '../../../src/identity/use-query';
import {
  IdentityQueryState,
  IdentityModeNotice,
  IdentityMutationError,
} from '../../../src/identity/query-state';

function UserAccessActions({
  user,
  roles,
  access,
  refresh,
  refreshing,
}: Readonly<{
  user: DirectoryUser;
  roles: readonly DirectoryRole[];
  access: IdentityAccess;
  refresh: () => void;
  refreshing: boolean;
}>) {
  const { t } = useFrontendTranslation();
  const port = useIdentityPort();
  const { notify } = useFeedback();
  const [draft, setDraft] = useState<Readonly<{
    roleIds: readonly string[];
    version: number;
  }> | null>(null);
  const [failure, setFailure] = useState<IdentityError | null>(null);
  const [pending, setPending] = useState(false);
  const busy = pending || refreshing;
  const roleLabel = (id: string) =>
    ['administrator', 'operator', 'viewer'].includes(id)
      ? t(`identityProduct.roleNames.${id}`)
      : (roles.find((role) => role.id === id)?.name ?? id);
  const selected = draft?.roleIds ?? user.roleIds;
  const dirty =
    draft !== null &&
    JSON.stringify([...selected].sort()) !== JSON.stringify([...user.roleIds].sort());
  const self = user.id === port.currentUserId();
  const canRoles = !self && access.permissions.includes('users.roles');
  const canStatus = !self && access.permissions.includes('users.status');
  useRegisterDirtySource({
    pageId: `users.detail.roles:${user.id}`,
    message: () => t('identityProduct.unsaved'),
    isDirty: () => dirty,
    isSubmitting: () => pending,
  });
  async function mutate(kind: 'roles' | 'status') {
    if (busy) return;
    setPending(true);
    setFailure(null);
    try {
      if (kind === 'roles') await port.setRoles(user.id, draft?.version ?? user.version, selected);
      else
        await port.setStatus(
          user.id,
          user.version,
          user.status === 'active' ? 'disabled' : 'active',
        );
      setDraft(null);
      const title = t(kind === 'roles' ? 'users.rolesSaved' : 'users.statusSaved');
      notify({ title, tone: 'success' });
    } catch (error) {
      const identityError =
        error instanceof IdentityError ? error : new IdentityError('unavailable');
      setFailure(identityError);
      throw identityError;
    } finally {
      setPending(false);
    }
  }
  const failureText = failure
    ? t(`identityProduct.errors.${failure.code}`) +
      (failure.reason ? `: ${t(`identityProduct.reasons.${failure.reason}`)}` : '')
    : t('users.failure');
  return (
    <>
      <Section title={t('identityProduct.roles')} description={t('users.rolesDescription')}>
        <div className="grid gap-4 p-5">
          <IdentityMutationError
            error={failure}
            reload={() => {
              setDraft(null);
              setFailure(null);
              refresh();
            }}
          />
          {self ? (
            <p className="text-sm text-ink-muted">{t('identityProduct.selfProtected')}</p>
          ) : !canRoles ? (
            <p className="text-sm text-ink-muted">{t('identityProduct.readonly')}</p>
          ) : null}
          <fieldset className="grid gap-3" disabled={!canRoles || busy}>
            <legend className="sr-only">{t('identityProduct.roles')}</legend>
            <div data-reveal-items className="grid gap-3 sm:grid-cols-3">
              {roles.map((role) => (
                <CheckboxField
                  key={role.id}
                  label={roleLabel(role.id)}
                  checked={selected.includes(role.id)}
                  disabled={
                    !canRoles ||
                    busy ||
                    (!selected.includes(role.id) &&
                      role.permissions.some(
                        (permission) => !access.permissions.includes(permission),
                      ))
                  }
                  onCheckedChange={(checked) => {
                    const roleIds = checked
                      ? [...selected, role.id]
                      : selected.filter((id) => id !== role.id);
                    setDraft({ roleIds, version: draft?.version ?? user.version });
                  }}
                />
              ))}
            </div>
          </fieldset>
          {canRoles ? (
            <div className="flex flex-wrap items-center gap-3">
              <ConfirmDialog
                triggerLabel={t('users.saveRoles')}
                title={t('users.confirmRoles')}
                description={t('users.rolesDescription')}
                impact={
                  <p>
                    {t('users.rolesImpact', {
                      email: user.email,
                      roles: selected.map(roleLabel).join(' / '),
                    })}
                  </p>
                }
                cancelLabel={t('identityProduct.cancel')}
                confirmLabel={t('identityProduct.save')}
                failureMessage={failureText}
                confirmDisabled={!dirty || selected.length === 0 || busy}
                onConfirm={() => mutate('roles')}
              />
              <Action
                variant="quiet"
                disabled={busy || !draft}
                onPress={() => {
                  setDraft(null);
                  setFailure(null);
                }}
              >
                {t('identityProduct.reset')}
              </Action>
            </div>
          ) : null}
        </div>
      </Section>
      <Section title={t('users.manageStatus')} description={t('users.statusDescription')}>
        <div className="grid gap-3 p-5">
          <StatusPill tone={user.status === 'active' ? 'success' : 'neutral'}>
            {t(`identityProduct.${user.status}`)}
          </StatusPill>
          {canStatus ? (
            <ConfirmDialog
              triggerLabel={t(user.status === 'active' ? 'users.disable' : 'users.enable')}
              title={t('users.confirmStatus')}
              description={t('users.confirmStatusDescription', { name: user.name })}
              impact={
                <p>
                  {t('users.statusImpact', {
                    email: user.email,
                    status: t(
                      user.status === 'active'
                        ? 'identityProduct.disabled'
                        : 'identityProduct.active',
                    ),
                  })}
                </p>
              }
              tone={user.status === 'active' ? 'danger' : 'primary'}
              cancelLabel={t('identityProduct.cancel')}
              confirmLabel={t('identityProduct.save')}
              failureMessage={failureText}
              confirmDisabled={busy || dirty}
              onConfirm={() => mutate('status')}
            />
          ) : (
            <p className="text-sm text-ink-muted">
              {t(self ? 'identityProduct.selfProtected' : 'identityProduct.readonly')}
            </p>
          )}
          {dirty ? (
            <p className="text-sm text-ink-muted">{t('users.saveRolesBeforeStatus')}</p>
          ) : null}
        </div>
      </Section>
    </>
  );
}

export function UserDetailPage({ id }: Readonly<{ id: string | null }>) {
  const { t, locale } = useFrontendTranslation();
  const port = useIdentityPort();
  const workbench = useWorkbenchPort();
  const preferences = usePreferencesPort<Preferences>().getSnapshot();
  const query = useIdentityQuery(`users.detail:${id ?? ''}`, async (service) => {
    const { identifierSchema } = await import('../../../src/identity/model');
    const access = await service.access();
    if (!access.permissions.includes('users.read')) throw new IdentityError('forbidden');
    if (!id || !identifierSchema.safeParse(id).success) throw new IdentityError('not-found');
    const [user, roles] = await Promise.all([service.read(id), service.roles()]);
    return { user, access, roles };
  });
  const favoritePath = `/users/detail?id=${encodeURIComponent(id ?? '')}`;
  const isFavorite = useSyncExternalStore(
    (listener) => workbench.subscribe(listener),
    () => workbench.isFavorite(favoritePath),
    () => false,
  );
  const data = query.data;
  const roleLabel = (roleId: string) =>
    ['administrator', 'operator', 'viewer'].includes(roleId)
      ? t(`identityProduct.roleNames.${roleId}`)
      : (data?.roles.find((role) => role.id === roleId)?.name ?? roleId);
  const timestamp = (value: string) => (
    <time dateTime={value}>
      {formatDate(
        locale,
        value,
        preferences.localeRegion.timeZone === 'auto'
          ? {}
          : { timeZone: preferences.localeRegion.timeZone },
      )}{' '}
      · {formatTimeOfDay(locale, preferences.localeRegion, value)}
    </time>
  );
  return (
    <Page>
      <PageHeader
        eyebrow={t('users.eyebrow')}
        title={data?.user.name ?? t('users.detail')}
        description={t('users.detailDescription')}
        actions={
          <>
            <RouteLink target={route('users')}>{t('users.back')}</RouteLink>
            {data?.access.permissions.includes('users.update') ? (
              <RouteLink target={route('users.edit', {}, { query: { id: data.user.id } })}>
                {t('users.edit')}
              </RouteLink>
            ) : null}
            {data ? (
              <IconAction
                label={t(isFavorite ? 'users.removeFavorite' : 'users.favorite')}
                onPress={() =>
                  workbench.toggleFavorite({ pathname: favoritePath, title: data.user.name })
                }
              >
                <span aria-hidden="true">{isFavorite ? '★' : '☆'}</span>
              </IconAction>
            ) : null}
          </>
        }
      />
      <IdentityModeNotice mode={port.mode} />
      {query.error || !data ? (
        <IdentityQueryState error={query.error} retry={query.reload} />
      ) : (
        <>
          <Section title={t('users.details')}>
            <div className="p-5">
              <DescriptionList
                label={t('users.details')}
                columns={2}
                items={[
                  { id: 'id', term: t('users.id'), description: data.user.id },
                  { id: 'email', term: t('identityProduct.email'), description: data.user.email },
                  {
                    id: 'status',
                    term: t('identityProduct.status'),
                    description: (
                      <StatusPill tone={data.user.status === 'active' ? 'success' : 'neutral'}>
                        {t(`identityProduct.${data.user.status}`)}
                      </StatusPill>
                    ),
                  },
                  {
                    id: 'roles',
                    term: t('identityProduct.roles'),
                    description: data.user.roleIds.map(roleLabel).join(' / '),
                  },
                  {
                    id: 'created',
                    term: t('users.createdAt'),
                    description: timestamp(data.user.createdAt),
                  },
                  {
                    id: 'updated',
                    term: t('users.updatedAt'),
                    description: timestamp(data.user.updatedAt),
                  },
                ]}
              />
            </div>
          </Section>
          <UserAccessActions
            key={data.user.id}
            user={data.user}
            roles={data.roles}
            access={data.access}
            refresh={query.reload}
            refreshing={query.loading}
          />
        </>
      )}
    </Page>
  );
}

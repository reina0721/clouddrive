'use client';
import { useState, useRef } from 'react';
import { useFrontendTranslation, formatNumber } from '@clouddrive/i18n';
import { Section } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { SelectField } from '@clouddrive/ui-adapter/form-field';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { route, RouteLink } from '@clouddrive/plugin-framework/plugin';
import {
  useIdentityPort,
  IdentityError,
  defaultUserQuery,
  type DirectoryUser,
} from '@clouddrive/surface/identity/runtime';
import { useIdentityQuery } from '../../../src/identity/use-query';
import { IdentityQueryState, IdentityMutationError } from '../../../src/identity/query-state';
export function RoleMembers({ roleId, allowed }: Readonly<{ roleId: string; allowed: boolean }>) {
  const { t, locale } = useFrontendTranslation();
  const port = useIdentityPort();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidateId, setCandidateId] = useState('');
  const [confirmation, setConfirmation] = useState<Readonly<{
    user: DirectoryUser;
    add: boolean;
  }> | null>(null);
  const [failure, setFailure] = useState<IdentityError | null>(null);
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const members = useIdentityQuery(`role.members:${roleId}:${page}`, (service) =>
    service.roleMembers(roleId, { ...defaultUserQuery, page, pageSize: 10 }),
  );
  const candidates = useIdentityQuery(
    `role.candidates:${roleId}:${search}:${candidatePage}:${allowed}`,
    async (service) =>
      allowed
        ? service.list({ ...defaultUserQuery, q: search, page: candidatePage, pageSize: 10 })
        : null,
  );
  const eligible =
    candidates.data?.items.filter(
      (user) => !user.roleIds.includes(roleId) && user.id !== port.currentUserId(),
    ) ?? [];
  async function commit() {
    if (!confirmation || locked.current) return;
    locked.current = true;
    setPending(true);
    setFailure(null);
    try {
      await port.changeRoleMember(
        roleId,
        confirmation.user.id,
        confirmation.user.version,
        confirmation.add,
      );
      setConfirmation(null);
      setCandidateId('');
      members.reload();
      candidates.reload();
    } catch (error) {
      setFailure(error instanceof IdentityError ? error : new IdentityError('unavailable'));
      throw error;
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  return (
    <Section title={t('roles.members')} description={t('roles.membersHint')}>
      <div className="grid gap-4 p-5">
        <IdentityMutationError
          error={failure}
          reload={() => {
            members.reload();
            candidates.reload();
          }}
        />
        {members.error || !members.data ? (
          <IdentityQueryState error={members.error} retry={members.reload} />
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              {t('roles.memberCount', { value: formatNumber(locale, members.data.total) })}
            </p>
            <ul data-reveal-items className="divide-y divide-border">
              {members.data.items.map((user) => (
                <li
                  key={user.id}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <RouteLink target={route('users.detail', {}, { query: { id: user.id } })}>
                      {user.name}
                    </RouteLink>
                    <p className="break-words text-sm text-ink-muted">{user.email}</p>
                  </div>
                  {allowed ? (
                    <Action
                      variant="quiet"
                      disabled={
                        pending || user.id === port.currentUserId() || user.roleIds.length === 1
                      }
                      onPress={() => setConfirmation({ user, add: false })}
                    >
                      {t('roles.removeMember')}
                    </Action>
                  ) : null}
                </li>
              ))}
            </ul>
            {!members.data.items.length ? (
              <p className="text-ink-muted">{t('roles.noMembers')}</p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Action
                variant="secondary"
                disabled={pending || page <= 1}
                onPress={() => setPage(page - 1)}
              >
                {t('management.previous')}
              </Action>
              <Action
                variant="secondary"
                disabled={pending || page * 10 >= members.data.total}
                onPress={() => setPage(page + 1)}
              >
                {t('management.next')}
              </Action>
            </div>
          </>
        )}
        {allowed ? (
          <div className="grid min-w-0 gap-3 border-t border-border pt-4">
            <SearchBox
              label={t('roles.findMember')}
              placeholder={t('roles.findMember')}
              value={search}
              onValueChange={(value) => {
                setSearch(value);
                setCandidatePage(1);
                setCandidateId('');
              }}
            />
            {candidates.error ? (
              <IdentityQueryState error={candidates.error} retry={candidates.reload} />
            ) : (
              <>
                <SelectField
                  label={t('roles.addMember')}
                  value={candidateId}
                  options={eligible.map((user) => ({
                    value: user.id,
                    label: `${user.name} · ${user.email}`,
                  }))}
                  onValueChange={setCandidateId}
                  disabled={pending || candidates.loading}
                />
                <div className="flex flex-wrap gap-3">
                  <Action
                    disabled={pending || !eligible.some((user) => user.id === candidateId)}
                    onPress={() => {
                      const user = eligible.find((user) => user.id === candidateId);
                      if (user) setConfirmation({ user, add: true });
                    }}
                  >
                    {t('roles.addMember')}
                  </Action>
                  <Action
                    variant="quiet"
                    disabled={pending || candidatePage <= 1}
                    onPress={() => {
                      setCandidatePage(candidatePage - 1);
                      setCandidateId('');
                    }}
                  >
                    {t('management.previous')}
                  </Action>
                  <Action
                    variant="quiet"
                    disabled={
                      pending || !candidates.data || candidatePage * 10 >= candidates.data.total
                    }
                    onPress={() => {
                      setCandidatePage(candidatePage + 1);
                      setCandidateId('');
                    }}
                  >
                    {t('management.next')}
                  </Action>
                </div>
              </>
            )}
            <p className="text-sm text-ink-muted">{t('roles.memberProtection')}</p>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">{t('roles.memberReadonly')}</p>
        )}
        <RouteLink target={route('users', {}, { query: { roleId } })}>
          {t('roles.allMembers')}
        </RouteLink>
      </div>
      <ConfirmDialog
        triggerLabel=""
        title={t(confirmation?.add ? 'roles.addMember' : 'roles.removeMember')}
        description={confirmation?.user.name ?? ''}
        impact={t('roles.memberImpact')}
        cancelLabel={t('roles.memberCancel')}
        confirmLabel={t('roles.memberApply')}
        failureMessage={t('roles.memberFailure')}
        isOpen={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        onConfirm={commit}
      />
    </Section>
  );
}

'use client';
import { useState } from 'react';
import { useFrontendTranslation, formatNumber } from '@clouddrive/i18n';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { Collection, CollectionQuery } from '@clouddrive/surface-foundation/collection';
import { DataTable, type DataColumn } from '@clouddrive/ui-adapter/data-display';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { SelectField } from '@clouddrive/ui-adapter/form-field';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { Action } from '@clouddrive/ui-adapter/action';
import { route, RouteLink } from '@clouddrive/plugin-framework/plugin';
import { KeyRound, Plus, RefreshCw, X } from '../../../src/action-icons';
import {
  IdentityError,
  useIdentityPort,
  type RoleSummary,
} from '@clouddrive/surface/identity/runtime';
import { useIdentityQuery } from '../../../src/identity/use-query';
import {
  IdentityModeNotice,
  IdentityQueryState,
  IdentityEmptyState,
} from '../../../src/identity/query-state';

export function RolesPage() {
  const { t, locale } = useFrontendTranslation();
  const port = useIdentityPort();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'system' | 'custom'>('all');
  const result = useIdentityQuery('roles-summary', async (service) => {
    const access = await service.access();
    if (!access.permissions.includes('roles.read')) throw new IdentityError('forbidden');
    return { access, roles: await service.roleSummaries() };
  });

  const label = (role: RoleSummary) =>
    ['administrator', 'operator', 'viewer'].includes(role.id)
      ? t(`identityProduct.roleNames.${role.id}`)
      : role.name;

  const roles = (result.data?.roles ?? []).filter((role) => {
    const matchSearch = label(role).toLowerCase().includes(search.trim().toLowerCase());
    if (!matchSearch) return false;
    if (typeFilter === 'system') return role.protected;
    if (typeFilter === 'custom') return !role.protected;
    return true;
  });

  const name = (role: RoleSummary) => (
    <RouteLink target={route('roles.detail', {}, { query: { id: role.id } })}>
      {label(role)}
    </RouteLink>
  );

  const summary = (role: RoleSummary) =>
    role.permissions.length
      ? role.permissions
          .slice(0, 3)
          .map((permission) => t(`management.permissions.${permission}`))
          .join(' / ') +
        (role.permissions.length > 3
          ? t('roles.morePermissions', { count: role.permissions.length - 3 })
          : '')
      : t('roles.noPermissions');

  const columns: readonly DataColumn<RoleSummary>[] = [
    { id: 'name', label: t('roles.name'), rowHeader: true, render: name },
    {
      id: 'type',
      label: t('roles.type'),
      render: (role) => (
        <StatusPill tone={role.protected ? 'neutral' : 'success'}>
          {t(role.protected ? 'roles.system' : 'roles.custom')}
        </StatusPill>
      ),
    },
    { id: 'permissions', label: t('roles.permissions'), render: summary },
    {
      id: 'members',
      label: t('roles.members'),
      render: (role) => (
        <span className="tabular-nums">{formatNumber(locale, role.memberCount)}</span>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title={t('roles.nav')}
        description={t('roles.description')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RouteLink
              target={route('roles.permissions')}
              presentation="action"
              variant="secondary"
              leadingIcon={<KeyRound className="size-4" />}
            >
              {t('roles.permissions')}
            </RouteLink>
            {result.data?.access.permissions.includes('roles.create') ? (
              <RouteLink
                target={route('roles.create')}
                presentation="action"
                variant="primary"
                leadingIcon={<Plus className="size-4" />}
              >
                {t('roles.create')}
              </RouteLink>
            ) : null}
          </div>
        }
      />
      <IdentityModeNotice mode={port.mode} />
      {result.error || !result.data ? (
        <IdentityQueryState error={result.error} retry={result.reload} />
      ) : (
        <Collection
          title={t('roles.list')}
          count={formatNumber(locale, roles.length)}
          tools={
            <IconAction
              label={t('identityProduct.refresh')}
              tooltip
              loading={result.loading}
              onPress={result.reload}
            >
              <RefreshCw className="size-4" />
            </IconAction>
          }
          query={
            <CollectionQuery
              search={
                <SearchBox
                  label={t('roles.search')}
                  placeholder={t('roles.search')}
                  value={search}
                  onValueChange={setSearch}
                />
              }
              filters={
                <SelectField
                  presentation="toolbar"
                  label={t('roles.type')}
                  value={typeFilter}
                  options={[
                    { value: 'all', label: t('identityProduct.all') },
                    { value: 'system', label: t('roles.system') },
                    { value: 'custom', label: t('roles.custom') },
                  ]}
                  onValueChange={(val) => {
                    if (val === 'all' || val === 'system' || val === 'custom') {
                      setTypeFilter(val);
                    }
                  }}
                />
              }
              reset={
                search || typeFilter !== 'all' ? (
                  <Action
                    variant="quiet"
                    size="sm"
                    leadingIcon={<X className="size-3.5" />}
                    onPress={() => {
                      setSearch('');
                      setTypeFilter('all');
                    }}
                  >
                    {t('identityProduct.clear')}
                  </Action>
                ) : null
              }
            />
          }
          content={
            <DataTable
              label={t('roles.list')}
              columns={columns}
              rows={roles}
              emptyContent={
                <div className="p-6">
                  <IdentityEmptyState
                    title={t('roles.empty')}
                    description={t('roles.description')}
                    clearLabel={
                      search || typeFilter !== 'all' ? t('identityProduct.clear') : undefined
                    }
                    onClear={
                      search || typeFilter !== 'all'
                        ? () => {
                            setSearch('');
                            setTypeFilter('all');
                          }
                        : undefined
                    }
                  />
                </div>
              }
            />
          }
          narrowContent={
            <ul data-reveal-items className="divide-y divide-border">
              {roles.map((role) => (
                <li key={role.id} className="grid gap-2.5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{name(role)}</span>
                    <StatusPill tone={role.protected ? 'neutral' : 'success'}>
                      {t(role.protected ? 'roles.system' : 'roles.custom')}
                    </StatusPill>
                  </div>
                  <p className="text-sm text-ink-muted">{summary(role)}</p>
                  <p className="text-xs text-ink-muted">
                    {t('roles.memberCount', { value: formatNumber(locale, role.memberCount) })}
                  </p>
                </li>
              ))}
              {!roles.length ? (
                <li className="p-6">
                  <IdentityEmptyState
                    title={t('roles.empty')}
                    description={t('roles.description')}
                  />
                </li>
              ) : null}
            </ul>
          }
        />
      )}
    </Page>
  );
}

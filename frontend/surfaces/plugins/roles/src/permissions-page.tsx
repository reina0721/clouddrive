'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { route, RouteLink } from '@clouddrive/plugin-framework/plugin';
import {
  IdentityError,
  permissionCodes,
  useIdentityPort,
} from '@clouddrive/surface/identity/runtime';
import { useIdentityQuery } from '../../../src/identity/use-query';
import { IdentityModeNotice, IdentityQueryState } from '../../../src/identity/query-state';
export function PermissionsPage() {
  const { t } = useFrontendTranslation();
  const port = useIdentityPort();
  const result = useIdentityQuery('roles.permissions', async (service) => {
    const access = await service.access();
    if (!access.permissions.includes('roles.read')) throw new IdentityError('forbidden');
    return service.roles();
  });
  return (
    <Page>
      <PageHeader
        title={t('roles.permissions')}
        description={t('roles.description')}
        actions={<RouteLink target={route('roles')}>{t('roles.back')}</RouteLink>}
      />
      <IdentityModeNotice mode={port.mode} />
      {result.error || !result.data ? (
        <IdentityQueryState error={result.error} retry={result.reload} />
      ) : (
        <>
          {['users', 'roles', 'account', 'audit', 'settings'].map((resource) => (
            <Section key={resource} title={t(`management.resources.${resource}`)}>
              <ul data-reveal-items className="grid gap-4 p-5 md:grid-cols-2">
                {permissionCodes
                  .filter((permission) => permission.startsWith(`${resource}.`))
                  .map((permission) => (
                    <li
                      key={permission}
                      className="grid gap-3 rounded-panel border border-border p-4"
                    >
                      <p className="text-sm font-semibold">
                        {t(`management.permissions.${permission}`)}
                      </p>
                      <code className="text-xs text-ink-muted">{permission}</code>
                      <ul className="flex flex-wrap gap-3">
                        {result.data
                          ?.filter((role) => role.permissions.includes(permission))
                          .map((role) => (
                            <li key={role.id}>
                              <RouteLink
                                target={route('roles.detail', {}, { query: { id: role.id } })}
                              >
                                {['administrator', 'operator', 'viewer'].includes(role.id)
                                  ? t(`identityProduct.roleNames.${role.id}`)
                                  : role.name}
                              </RouteLink>
                            </li>
                          ))}
                      </ul>
                    </li>
                  ))}
              </ul>
            </Section>
          ))}
        </>
      )}
    </Page>
  );
}

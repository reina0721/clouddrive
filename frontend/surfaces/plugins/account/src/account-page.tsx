'use client';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useIdentityPort, IdentityError } from '@clouddrive/surface/identity/runtime';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { useIdentityQuery } from '../../../src/identity/use-query';
import { IdentityQueryState, IdentityModeNotice } from '../../../src/identity/query-state';
import { UserForm } from '../../../src/identity/user-form';
import { AccountSecurity } from './account-security';
import { BackendProfile } from './backend-profile';
import { BackendPreferences } from './backend-preferences';
export function AccountPage() {
  const { t } = useFrontendTranslation();
  const port = useIdentityPort();
  const query = useIdentityQuery('account', async (service) => {
    const [access, user, roles] = await Promise.all([
      service.access(),
      service.me(),
      service.roles(true),
    ]);
    if (access.user.id !== user.id || user.id !== service.currentUserId())
      throw new IdentityError('protocol');
    return { access, user, roles };
  });
  const data = query.data;
  const roleLabel = (id: string) =>
    ['administrator', 'operator', 'viewer'].includes(id)
      ? t(`identityProduct.roleNames.${id}`)
      : (data?.roles.find((role) => role.id === id)?.name ?? id);
  return (
    <Page>
      <PageHeader
        eyebrow={t('account.eyebrow')}
        title={t('account.title')}
        description={t('account.description')}
      />
      <IdentityModeNotice mode={port.mode} />
      {query.error || !data ? (
        <IdentityQueryState error={query.error} retry={query.reload} />
      ) : (
        <>
          <Section appearance="outlined" title={t('account.profile')}>
            <div className="grid gap-5 p-5">
              <UserForm
                key={data.user.id}
                mode="profile"
                presentation="embedded"
                saveLabel={t('account.saveProfile')}
                user={data.user}
                roles={data.roles}
                access={data.access}
                onSaved={query.reload}
              />
              <div className="grid gap-4 border-t border-border pt-5">
                <p className="text-sm text-ink-muted">{t('account.roleDescription')}</p>
                <DescriptionList
                  label={t('account.details')}
                  columns={2}
                  items={[
                    { id: 'id', term: t('account.id'), description: data.user.id },
                    {
                      id: 'status',
                      term: t('identityProduct.status'),
                      description: t(`identityProduct.${data.user.status}`),
                    },
                    {
                      id: 'roles',
                      term: t('identityProduct.roles'),
                      description: data.user.roleIds.map(roleLabel).join(' / '),
                    },
                  ]}
                />
              </div>
            </div>
          </Section>
          {port.mode === 'backend' ? (
            <>
              <BackendProfile onSaved={query.reload} />
              <BackendPreferences />
            </>
          ) : null}
          <AccountSecurity />
        </>
      )}
    </Page>
  );
}

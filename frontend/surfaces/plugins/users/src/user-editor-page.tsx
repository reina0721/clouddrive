'use client';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { route, RouteLink } from '@clouddrive/plugin-framework/plugin';
import { useIdentityPort, IdentityError } from '@clouddrive/surface/identity/runtime';
import { useIdentityQuery } from '../../../src/identity/use-query';
import { IdentityQueryState, IdentityModeNotice } from '../../../src/identity/query-state';
import { UserForm } from '../../../src/identity/user-form';
export function UserEditorPage({ id }: Readonly<{ id?: string }>) {
  const { t } = useFrontendTranslation();
  const port = useIdentityPort();
  const mode = id === undefined ? 'create' : 'edit';
  const query = useIdentityQuery(`users.${mode}:${id ?? ''}`, async (service) => {
    const { identifierSchema } = await import('../../../src/identity/model');
    const access = await service.access();
    if (!access.permissions.includes(mode === 'create' ? 'users.create' : 'users.update'))
      throw new IdentityError('forbidden');
    if (id !== undefined && !identifierSchema.safeParse(id).success)
      throw new IdentityError('not-found');
    const [roles, user] = await Promise.all([
      service.roles(),
      id === undefined ? Promise.resolve(undefined) : service.read(id),
    ]);
    return { access, roles, user };
  });
  return (
    <Page>
      <PageHeader
        eyebrow={t('users.eyebrow')}
        title={t(`users.${mode === 'create' ? 'create' : 'edit'}`)}
        description={t(`users.${mode}Description`)}
        actions={
          <RouteLink target={id ? route('users.detail', {}, { query: { id } }) : route('users')}>
            {t('users.back')}
          </RouteLink>
        }
      />
      <IdentityModeNotice mode={port.mode} />
      {query.error || !query.data ? (
        <IdentityQueryState error={query.error} retry={query.reload} />
      ) : (
        <UserForm
          key={id ?? 'create'}
          mode={mode}
          {...(query.data.user ? { user: query.data.user } : {})}
          roles={query.data.roles}
          access={query.data.access}
        />
      )}
    </Page>
  );
}

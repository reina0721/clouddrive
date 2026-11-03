'use client';
/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState, type ReactNode } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { AsyncRegion } from '@clouddrive/ui-adapter/async-region';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { NavigationIcon } from '../navigation-icon-presentation';
import { IdentityError } from '../identity/errors';
import { useAdministration } from './context';

export function BackendOnly({ children }: Readonly<{ children: ReactNode }>) {
  const port = useAdministration();
  const { t } = useFrontendTranslation();
  return port ? (
    children
  ) : (
    <Page>
      <PageHeader
        title={t('administration.description')}
        description={t('administration.failureDescription')}
      />
      <StateSurface
        state="warning"
        icon={<NavigationIcon iconId="identity" />}
        title={t('administration.failure')}
        description={t('administration.description')}
      />
    </Page>
  );
}

export function useRemote<T>(load: () => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ value: T | null; error: unknown; loading: boolean }>({
    value: null,
    error: null,
    loading: true,
  });
  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (active) setState((prior) => ({ ...prior, loading: true, error: null }));
        return load();
      })
      .then(
        (value) => {
          if (active) setState({ value, error: null, loading: false });
        },
        (error) => {
          if (active) setState({ value: null, error, loading: false });
        },
      );
    return () => {
      active = false;
    };
  }, [load, revision]);
  return { ...state, reload: () => setRevision((value) => value + 1) };
}
export function RemoteRegion({
  loading,
  error,
  reload,
  children,
}: Readonly<{ loading: boolean; error: unknown; reload: () => void; children: ReactNode }>) {
  const { t } = useFrontendTranslation();
  const description =
    error instanceof IdentityError
      ? t(`identityProduct.errors.${error.code}`)
      : t('administration.failureDescription');
  return (
    <AsyncRegion
      phase={loading ? 'initial' : error ? 'error' : 'ready'}
      label={t('administration.loading')}
      loading={<p role="status">{t('administration.loading')}</p>}
      refreshing={null}
      empty={<p>{t('administration.empty')}</p>}
      error={
        <StateSurface
          state="warning"
          icon={<NavigationIcon iconId="identity" />}
          title={t('administration.failure')}
          description={description}
          actionLabel={t('administration.retry')}
          onAction={reload}
        />
      }
    >
      {children}
    </AsyncRegion>
  );
}

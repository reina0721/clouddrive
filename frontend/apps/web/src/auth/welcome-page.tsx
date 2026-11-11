'use client';
import Link from 'next/link';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useSiteProfile } from '@clouddrive/surface/administration/runtime';
export function WelcomePage() {
  const { t } = useFrontendTranslation();
  const { profile } = useSiteProfile();
  return (
    <Page>
      <PageHeader
        title={t('auth.welcomeTitle', { site: profile?.name || t('brand.name') })}
        description={t('auth.welcomeDescription')}
      />
      <Link
        className="inline-flex min-h-control items-center justify-center rounded-action bg-brand px-5 font-medium text-on-brand outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        href="/"
      >
        {t('auth.enterWorkspace')}
      </Link>
    </Page>
  );
}

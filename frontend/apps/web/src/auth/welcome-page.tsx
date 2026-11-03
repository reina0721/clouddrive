'use client';
import Link from 'next/link';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { useFrontendTranslation } from '@clouddrive/i18n';
export function WelcomePage() {
  const { t } = useFrontendTranslation();
  return (
    <Page>
      <PageHeader title={t('auth.welcomeTitle')} description={t('auth.welcomeDescription')} />
      <Link
        className="inline-flex min-h-control items-center justify-center rounded-control bg-brand px-5 font-semibold text-on-brand outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        href="/"
      >
        {t('auth.enterWorkspace')}
      </Link>
      <Link className="text-sm font-semibold text-brand underline" href="/register">
        {t('auth.registerLink')}
      </Link>
    </Page>
  );
}

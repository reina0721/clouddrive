'use client';

import { Suspense, lazy } from 'react';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Skeleton } from '@clouddrive/ui-adapter/skeleton';

const Workbench = lazy(() => import('../src/ui/workbench').then((m) => ({ default: m.Workbench })));

export default function ApiWorkbenchPage() {
  const { t } = useFrontendTranslation();

  return (
    <Page>
      <PageHeader
        title={t('apiWorkbench.page.title')}
        description={t('apiWorkbench.page.description')}
      />
      <Suspense
        fallback={
          <div className="grid gap-3 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <Workbench />
      </Suspense>
    </Page>
  );
}

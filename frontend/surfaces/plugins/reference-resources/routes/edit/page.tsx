'use client';
import { useSearchParams } from 'next/navigation';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { route, RouteLink } from '@clouddrive/plugin-framework/plugin';
import { ResourceForm } from '../../src/resource-form';
import { useReferenceResources } from '../../src/use-reference-resources';
export default function EditPage() {
  const { t } = useFrontendTranslation();
  const id = useSearchParams().get('id');
  const resource = useReferenceResources().find((item) => item.id === id);
  return resource ? (
    <ResourceForm resource={resource} key={resource.id} />
  ) : (
    <Page>
      <PageHeader
        title={t('referenceResources.common.notFound')}
        description={t('referenceResources.common.invalidId')}
        actions={
          <RouteLink target={route('reference-resources')}>
            {t('referenceResources.detail.back')}
          </RouteLink>
        }
      />
    </Page>
  );
}

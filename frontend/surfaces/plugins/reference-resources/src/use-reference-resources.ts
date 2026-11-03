import { useFrontendTranslation } from '@clouddrive/i18n';
import { useResourcesStore } from '../stores/resources';

/** Translate fixtures on read; user-entered names remain user data. */
export function useReferenceResources() {
  const { t } = useFrontendTranslation();
  const resources = useResourcesStore((state) => state.resources);
  return resources.map((resource) =>
    resource.fixture
      ? {
          ...resource,
          name: t('referenceResources.fixtures.' + resource.fixture + '.name'),
          description: t('referenceResources.fixtures.' + resource.fixture + '.description'),
        }
      : resource,
  );
}

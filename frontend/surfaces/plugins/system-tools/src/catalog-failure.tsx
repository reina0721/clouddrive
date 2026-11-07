'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { FilesError } from '../../../src/files/model';

export function CatalogFailure({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useFrontendTranslation();
  return (
    <div className="space-y-2">
      <p role="alert">
        {t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable'))}
      </p>
      <Action variant="secondary" onPress={retry}>
        {t('administration.retry')}
      </Action>
    </div>
  );
}

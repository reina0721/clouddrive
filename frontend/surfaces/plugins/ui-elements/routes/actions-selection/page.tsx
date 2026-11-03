import { Suspense } from 'react';
import { PageLoadingSurface } from '@clouddrive/surface-foundation/states-operations';

import { ActionsSelectionPage } from '../../src/actions-selection-page';

export default function ActionsSelectionRoute() {
  return (
    <Suspense fallback={<PageLoadingSurface kind="catalog" label="姝ｅ湪鍔犺浇鎿嶄綔缁勪欢" />}>
      <ActionsSelectionPage />
    </Suspense>
  );
}

import { Suspense } from 'react';
import { PageLoadingSurface } from '@clouddrive/surface-foundation/states-operations';

import { DataElementsPage } from '../../src/data-elements-page';

export default function DataElementsRoute() {
  return (
    <Suspense fallback={<PageLoadingSurface kind="catalog" label="姝ｅ湪鍔犺浇鏁版嵁缁勪欢" />}>
      <DataElementsPage />
    </Suspense>
  );
}

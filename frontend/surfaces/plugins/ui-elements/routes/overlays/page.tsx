import { Suspense } from 'react';
import { PageLoadingSurface } from '@clouddrive/surface-foundation/states-operations';

import { OverlayElementsPage } from '../../src/overlay-elements-page';

export default function OverlayElementsRoute() {
  return (
    <Suspense fallback={<PageLoadingSurface kind="catalog" label="姝ｅ湪鍔犺浇娴眰缁勪欢" />}>
      <OverlayElementsPage />
    </Suspense>
  );
}

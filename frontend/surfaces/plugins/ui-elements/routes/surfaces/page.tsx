import { Suspense } from 'react';
import { PageLoadingSurface } from '@clouddrive/surface-foundation/states-operations';

import { SurfacesPage } from '../../src/surfaces-page';

export default function SurfacesRoute() {
  return (
    <Suspense fallback={<PageLoadingSurface kind="catalog" label="姝ｅ湪鍔犺浇琛ㄩ潰缁勪欢" />}>
      <SurfacesPage />
    </Suspense>
  );
}

import { Suspense } from 'react';
import { PageLoadingSurface } from '@clouddrive/surface-foundation/states-operations';

import { IdentityDisplayPage } from '../../src/identity-display-page';

export default function IdentityDisplayRoute() {
  return (
    <Suspense fallback={<PageLoadingSurface kind="catalog" label="姝ｅ湪鍔犺浇韬唤缁勪欢" />}>
      <IdentityDisplayPage />
    </Suspense>
  );
}

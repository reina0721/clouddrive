import { Suspense } from 'react';
import { PageLoadingSurface } from '@clouddrive/surface-foundation/states-operations';

import { NavigationElementsPage } from '../../src/navigation-elements-page';

export default function NavigationElementsRoute() {
  return (
    <Suspense fallback={<PageLoadingSurface kind="catalog" label="姝ｅ湪鍔犺浇瀵艰埅缁勪欢" />}>
      <NavigationElementsPage />
    </Suspense>
  );
}

import { Suspense } from 'react';
import { PageLoadingSurface } from '@clouddrive/surface-foundation/states-operations';

import { StatusAsyncPage } from '../../src/status-async-page';

export default function StatusAsyncRoute() {
  return (
    <Suspense fallback={<PageLoadingSurface kind="catalog" label="正在加载异步状态组件" />}>
      <StatusAsyncPage />
    </Suspense>
  );
}

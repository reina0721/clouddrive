import { Suspense } from 'react';
import { PageLoadingSurface } from '@clouddrive/surface-foundation/states-operations';

import { FeedbackPage } from '../../src/feedback-page';

export default function FeedbackRoute() {
  return (
    <Suspense fallback={<PageLoadingSurface kind="catalog" label="姝ｅ湪鍔犺浇鍙嶉缁勪欢" />}>
      <FeedbackPage />
    </Suspense>
  );
}

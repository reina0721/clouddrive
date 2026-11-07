'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DownloadsPage } from '../../src/downloads-page';

function DownloadRouteContent() {
  const taskId = useSearchParams().get('task') ?? '';
  return <DownloadsPage key={taskId} taskId={taskId} />;
}

export default function DownloadsRoute() {
  return (
    <Suspense>
      <DownloadRouteContent />
    </Suspense>
  );
}

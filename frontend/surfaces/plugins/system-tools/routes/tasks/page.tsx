'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BackendOnly } from '../../../../src/administration/resource-state';
import { workerNodeIdPattern } from '../../../../src/files/worker-nodes';
import { AdminTasksPage } from '../../src/admin-tasks-page';

function TaskRouteContent() {
  const value = useSearchParams().get('nodeId') ?? '';
  const nodeId = workerNodeIdPattern.test(value) ? value : '';
  return <AdminTasksPage key={nodeId} nodeId={nodeId} />;
}

export default function Route() {
  return (
    <BackendOnly>
      <Suspense>
        <TaskRouteContent />
      </Suspense>
    </BackendOnly>
  );
}

'use client';
import { BackendOnly } from '../../../../src/administration/resource-state';
import { WorkerNodesPage } from '../../src/worker-nodes-page';

export default function Route() {
  return (
    <BackendOnly>
      <WorkerNodesPage />
    </BackendOnly>
  );
}

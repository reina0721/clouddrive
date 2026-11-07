'use client';
import { BackendOnly } from '../../../../src/administration/resource-state';
import { AdminTasksPage } from '../../src/admin-tasks-page';

export default function Route() {
  return (
    <BackendOnly>
      <AdminTasksPage />
    </BackendOnly>
  );
}

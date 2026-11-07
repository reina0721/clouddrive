'use client';
import { BackendOnly } from '../../../../src/administration/resource-state';
import { AdminSharesPage } from '../../src/admin-shares-page';

export default function Route() {
  return (
    <BackendOnly>
      <AdminSharesPage />
    </BackendOnly>
  );
}

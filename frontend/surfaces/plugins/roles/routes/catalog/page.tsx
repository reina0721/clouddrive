'use client';
import { PermissionCatalogPage } from '../../src/permission-catalog-page';
import { BackendOnly } from '../../../../src/administration/resource-state';
export default function Route() {
  return (
    <BackendOnly>
      <PermissionCatalogPage />
    </BackendOnly>
  );
}

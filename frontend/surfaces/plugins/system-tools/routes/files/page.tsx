'use client';
import { BackendOnly } from '../../../../src/administration/resource-state';
import { FileInventoryPage } from '../../src/file-inventory-page';

export default function Route() {
  return (
    <BackendOnly>
      <FileInventoryPage />
    </BackendOnly>
  );
}

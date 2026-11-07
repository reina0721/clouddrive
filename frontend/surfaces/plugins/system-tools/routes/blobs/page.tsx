'use client';
import { BackendOnly } from '../../../../src/administration/resource-state';
import { BlobCatalogPage } from '../../src/blob-catalog-page';

export default function Route() {
  return (
    <BackendOnly>
      <BlobCatalogPage />
    </BackendOnly>
  );
}

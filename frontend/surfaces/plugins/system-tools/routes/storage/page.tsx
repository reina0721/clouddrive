'use client';
import { BackendOnly } from '../../../../src/administration/resource-state';
import { StoragePolicyPage } from '../../src/storage-policy-page';

export default function Route() {
  return (
    <BackendOnly>
      <StoragePolicyPage />
    </BackendOnly>
  );
}

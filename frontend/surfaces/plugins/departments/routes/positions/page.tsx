'use client';
import { OrganizationPage } from '../../src/backend-page';
import { BackendOnly } from '../../../../src/administration/resource-state';
export default function Route() {
  return (
    <BackendOnly>
      <OrganizationPage kind="positions" />
    </BackendOnly>
  );
}

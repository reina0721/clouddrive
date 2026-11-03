'use client';
import { AccountAdministrationPage } from '../../src/administration-page';
import { BackendOnly } from '../../../../src/administration/resource-state';
export default function Route() {
  return (
    <BackendOnly>
      <AccountAdministrationPage />
    </BackendOnly>
  );
}

'use client';
import { BackendTokensPage } from '../../src/backend-security';
import { BackendOnly } from '../../../../src/administration/resource-state';
export default function Route() {
  return (
    <BackendOnly>
      <BackendTokensPage />
    </BackendOnly>
  );
}

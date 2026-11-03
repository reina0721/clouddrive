'use client';
import { BackendSecurityPage } from '../../src/backend-security';
import { BackendOnly } from '../../../../src/administration/resource-state';
export default function Route() {
  return (
    <BackendOnly>
      <BackendSecurityPage />
    </BackendOnly>
  );
}

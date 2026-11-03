'use client';
import { RuntimePage } from '../../src/runtime-page';
import { BackendOnly } from '../../../../src/administration/resource-state';
export default function Route() {
  return (
    <BackendOnly>
      <RuntimePage />
    </BackendOnly>
  );
}

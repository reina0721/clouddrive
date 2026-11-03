'use client';
import { AssignmentPage } from '../../src/assignment-page';
import { BackendOnly } from '../../../../src/administration/resource-state';
export default function Route() {
  return (
    <BackendOnly>
      <AssignmentPage />
    </BackendOnly>
  );
}

'use client';

import { useAdministration } from '../../../src/administration/context';
import { OrganizationPage } from '../src/backend-page';
import { DepartmentsPage } from '../src/departments-page';

export default function DepartmentsRoute() {
  const port = useAdministration();
  if (port) return <OrganizationPage />;
  return <DepartmentsPage />;
}

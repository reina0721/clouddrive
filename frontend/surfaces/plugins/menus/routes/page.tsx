'use client';

import { useAdministration } from '../../../src/administration/context';
import { BackendMenusPage } from '../src/backend-page';
import { MenusPage } from '../src/menus-page';

export default function MenusRoute() {
  const port = useAdministration();
  if (port) return <BackendMenusPage />;
  return <MenusPage />;
}

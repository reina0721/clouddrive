'use client';

import { useAdministration } from '../../../src/administration/context';
import { BackendDictionariesPage } from '../src/backend-page';
import { DictionariesPage } from '../src/dictionaries-page';

export default function DictionariesRoute() {
  const port = useAdministration();
  if (port) return <BackendDictionariesPage />;
  return <DictionariesPage />;
}

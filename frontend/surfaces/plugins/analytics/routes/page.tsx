'use client';

import { useAdministration } from '../../../src/administration/context';
import { BackendAnalyticsPage } from '../src/backend-page';
import { AnalyticsPage } from '../src/analytics-page';

export default function AnalyticsRoute() {
  const port = useAdministration();
  return port ? <BackendAnalyticsPage /> : <AnalyticsPage />;
}

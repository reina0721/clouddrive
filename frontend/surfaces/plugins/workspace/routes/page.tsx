'use client';

import { useAdministration } from '../../../src/administration/context';
import { BackendWorkspacePage } from '../src/backend-page';
import { WorkspacePage } from '../src/workspace-page';

export default function WorkspaceRoute() {
  const port = useAdministration();
  if (port) return <BackendWorkspacePage />;
  return <WorkspacePage />;
}

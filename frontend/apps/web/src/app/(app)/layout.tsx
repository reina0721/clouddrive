import type { ReactNode } from 'react';
import { ApiWorkbenchRuntime } from '../../api-workbench/runtime';
import { ProtectedGate } from '../../auth/route-gates';
import { ApplicationChrome } from '../../shell/application-chrome';

export default function ApplicationLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ProtectedGate>
      <ApiWorkbenchRuntime>
        <ApplicationChrome>{children}</ApplicationChrome>
      </ApiWorkbenchRuntime>
    </ProtectedGate>
  );
}

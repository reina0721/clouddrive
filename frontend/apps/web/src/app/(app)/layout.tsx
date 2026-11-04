import type { ReactNode } from 'react';
import { ProtectedGate } from '../../auth/route-gates';
import { ApplicationChrome } from '../../shell/application-chrome';

export default function ApplicationLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ProtectedGate>
      <ApplicationChrome>{children}</ApplicationChrome>
    </ProtectedGate>
  );
}

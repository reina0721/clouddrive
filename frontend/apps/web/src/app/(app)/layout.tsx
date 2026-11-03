import type { ReactNode } from 'react';
import { ProtectedGate } from '../../auth/route-gates';
import { AppShell } from '../../shell/app-shell';

export default function ApplicationLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ProtectedGate>
      <AppShell>{children}</AppShell>
    </ProtectedGate>
  );
}

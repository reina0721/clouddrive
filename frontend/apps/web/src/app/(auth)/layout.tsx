import { Suspense, type ReactNode } from 'react';
import { GuestGate } from '../../auth/route-gates';
import { AuthStatusSurface } from '../../auth/status-surface';

export default function AuthenticationLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Suspense fallback={<AuthStatusSurface />}>
      <GuestGate>{children}</GuestGate>
    </Suspense>
  );
}

'use client';
import { useRouter } from 'next/navigation';
import { AccountMenu } from '../shell/account-menu';
import { routeTargetResolver } from '../host/route-target-resolver';
import { requestLock } from '../shell/use-idle-lock';
export function FileAccountMenu() {
  const router = useRouter();
  return (
    <AccountMenu
      compact
      presentation="avatar"
      onNavigate={(destination) => {
        if (destination === 'lock-screen') requestLock();
        else router.push(routeTargetResolver.resolveHref({ routeId: destination, params: {} }));
      }}
    />
  );
}

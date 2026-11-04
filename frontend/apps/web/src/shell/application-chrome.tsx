'use client';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/context';
import { AppLoadingSurface } from '../host/app-loading-surface';
import { RouteTransition } from '../host/route-transition';
import { useLockStore } from '../state/use-lock-store';
import { useShellStore } from '../state/use-shell-store';
import { useIdleLock } from './use-idle-lock';

const loading = () => <AppLoadingSurface label="正在加载应用 / Loading application" />;
// 文件运行域仍跨路由保持唯一所有者，只延后其脚本加载；不在切换工作区时重建上传队列。
const FilesRuntime = dynamic(
  async () => {
    const [module, messages] = await Promise.all([
      import('../files/runtime'),
      import('../files/messages'),
    ]);
    await messages.initializeFileMessages();
    return module.FilesRuntime;
  },
  { ssr: false, loading },
);
const AppShell = dynamic(() => import('./app-shell').then((module) => module.AppShell), {
  ssr: false,
  loading,
});

const LockScreen = dynamic(() => import('./lock-screen').then((module) => module.LockScreen), {
  ssr: false,
});

export function ApplicationChrome({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const account = useAuth().session?.user.id ?? null;
  const idleLockMinutes = useShellStore((state) => state.preferences.security.idleLockMinutes);
  const lockOnHidden = useShellStore((state) => state.preferences.security.lockOnHidden);
  useIdleLock(account, { idleLockMinutes, lockOnHidden });
  const locked = useLockStore((state) => state.locked);
  const fileWorkspace = pathname === '/home' || pathname.startsWith('/home/');
  return (
    <FilesRuntime fileWorkspace={fileWorkspace}>
      <LockScreen />
      <div inert={locked}>
        {fileWorkspace ? (
          <RouteTransition>{children}</RouteTransition>
        ) : (
          <AppShell>{children}</AppShell>
        )}
      </div>
    </FilesRuntime>
  );
}

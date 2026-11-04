'use client';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { AppLoadingSurface } from '../host/app-loading-surface';
import { RouteTransition } from '../host/route-transition';

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

export function ApplicationChrome({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const fileWorkspace = pathname === '/home' || pathname.startsWith('/home/');
  return (
    <FilesRuntime fileWorkspace={fileWorkspace}>
      {fileWorkspace ? (
        <RouteTransition>{children}</RouteTransition>
      ) : (
        <AppShell>{children}</AppShell>
      )}
    </FilesRuntime>
  );
}

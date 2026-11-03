import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SkipLink } from '@clouddrive/ui-adapter/accessibility';

import { AppErrorBoundary } from '../host/error-boundary';
import { AppProviders } from '../host/providers';
import { AuthProvider } from '../auth/provider';
import '../styles.css';

// App Router 要求 layout 默认导出组件的同时导出 metadata；该导出由框架消费，不参与 Fast Refresh。
/* eslint-disable react-refresh/only-export-components */
export const metadata: Metadata = {
  title: 'clouddrive',
  description: 'clouddrive 管理工作区',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN" data-theme="light">
      <body>
        <AppErrorBoundary>
          <AppProviders>
            <AuthProvider>
              <SkipLink href="#main-content" label="跳到主要内容 / Skip to content" />
              {children}
            </AuthProvider>
          </AppProviders>
        </AppErrorBoundary>
      </body>
    </html>
  );
}

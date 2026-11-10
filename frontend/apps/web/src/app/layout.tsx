import type { ReactNode } from 'react';
import { SkipLink } from '@clouddrive/ui-adapter/accessibility';

import { AppErrorBoundary } from '../host/error-boundary';
import { AppProviders } from '../host/providers';
import { AuthProvider } from '../auth/provider';
import '../styles.css';

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

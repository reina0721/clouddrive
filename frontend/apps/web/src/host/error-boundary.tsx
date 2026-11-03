'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Card, CardContent } from '@clouddrive/ui-adapter/card';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { OctagonAlert } from 'lucide-react';

import { appI18n } from '../i18n/i18n';
import { failRouteNavigation } from './navigation-lifecycle';

type ErrorBoundaryState = { hasError: boolean };

export class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('frontend_root_boundary', {
      errorName: error.name,
      componentStack: info.componentStack,
    });
    // 路由渲染失败：立即结束当前全局导航，避免进度条永久停留。
    failRouteNavigation();
  }

  override render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center bg-canvas p-6 text-ink">
          <Card>
            <CardContent>
              <div className="max-w-lg">
                <p className="mb-3 text-sm font-semibold text-danger">
                  {appI18n.translate('common.rootErrorEyebrow')}
                </p>
                <StateSurface
                  compact
                  actionLabel={appI18n.translate('common.reload')}
                  description={appI18n.translate('common.rootErrorDescription')}
                  icon={<OctagonAlert className="size-5" />}
                  state="error"
                  title={appI18n.translate('common.rootErrorTitle')}
                  onAction={() => window.location.reload()}
                />
              </div>
            </CardContent>
          </Card>
        </main>
      );
    }
    return this.props.children;
  }
}

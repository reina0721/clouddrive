'use client';
import { useContext, useEffect, useMemo, type ReactNode } from 'react';
import { FilesProvider } from '@clouddrive/surface/files/runtime';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { Cloud } from 'lucide-react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { AuthContext } from '../auth/context';
import { readAuthConfig } from '../auth/config';
import { createFilesRuntime } from './backend';

export function FilesRuntime({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useFrontendTranslation();
  const controller = useContext(AuthContext);
  const runtime = useMemo(() => {
    const config = readAuthConfig();
    if (config.mode !== 'backend') return null;
    return createFilesRuntime(
      config.apiBaseUrl,
      () => controller?.getState().session?.user.id ?? null,
    );
  }, [controller]);
  useEffect(() => {
    if (!runtime) return;
    runtime.activate();
    return () => runtime.dispose();
  }, [runtime]);
  if (!runtime)
    return (
      <main id="main-content">
        <StateSurface
          state="disabled"
          icon={<Cloud />}
          title={t('common.filesUnavailableTitle')}
          description={t('common.filesUnavailableDescription')}
        />
      </main>
    );
  return (
    <FilesProvider port={runtime.port}>
      <div
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault();
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          runtime.offer(Array.from(event.dataTransfer.files));
        }}
      >
        {children}
      </div>
    </FilesProvider>
  );
}

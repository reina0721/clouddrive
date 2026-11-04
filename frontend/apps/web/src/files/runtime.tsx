'use client';
import { useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { FilesProvider, type FileMediaProps } from '@clouddrive/surface/files/runtime';
import { FilesError } from '@clouddrive/surface/files';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { Cloud } from 'lucide-react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { AuthContext } from '../auth/context';
import { readAuthConfig } from '../auth/config';
import { createFilesRuntime } from './backend';
import { FileMediaView } from './media-view';

export function FilesRuntime({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useFrontendTranslation();
  const controller = useContext(AuthContext);
  const [transferFailure, setTransferFailure] = useState('');
  const runtime = useMemo(() => {
    const config = readAuthConfig();
    if (config.mode !== 'backend') return null;
    return createFilesRuntime(
      config.apiBaseUrl,
      () => controller?.getState().session?.user.id ?? null,
    );
  }, [controller]);
  const Media = useMemo(
    () =>
      runtime
        ? function MediaRenderer(props: FileMediaProps) {
            return <FileMediaView {...props} readContent={runtime.readMedia} />;
          }
        : undefined,
    [runtime],
  );
  useLayoutEffect(() => {
    if (!runtime) return;
    runtime.activate();
    return () => runtime.dispose();
  }, [runtime]);
  if (!runtime || !Media)
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
    <FilesProvider port={runtime.port} media={Media}>
      <div
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault();
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          try {
            runtime.offer(Array.from(event.dataTransfer.files));
            setTransferFailure('');
          } catch (error) {
            setTransferFailure(
              t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
            );
          }
        }}
        onPaste={(event) => {
          if (!event.clipboardData?.files.length) return;
          if (
            event.target instanceof Element &&
            event.target.closest('input,textarea,[contenteditable="true"]')
          )
            return;
          event.preventDefault();
          try {
            runtime.offer(Array.from(event.clipboardData.files));
            setTransferFailure('');
          } catch (error) {
            setTransferFailure(
              t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
            );
          }
        }}
      >
        {transferFailure ? (
          <p role="alert" className="p-4 text-danger">
            {transferFailure}
          </p>
        ) : null}
        {children}
      </div>
    </FilesProvider>
  );
}

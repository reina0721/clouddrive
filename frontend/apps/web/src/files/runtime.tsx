'use client';
import { useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FilesProvider, type FileMediaProps } from '@clouddrive/surface/files/runtime';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { Cloud } from 'lucide-react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { AuthContext, useAuth } from '../auth/context';
import { readAuthConfig } from '../auth/config';
import { createFilesRuntime, fileDestinationHrefs } from './backend';
import { FileMediaView } from './media-view';

export function FilesRuntime({
  children,
  fileWorkspace,
}: Readonly<{ children: ReactNode; fileWorkspace: boolean }>) {
  const { t } = useFrontendTranslation();
  const controller = useContext(AuthContext);
  const account = useAuth().session?.user.id;
  const router = useRouter();
  const [transferFailure, setTransferFailure] = useState(false);
  const runtime = useMemo(() => {
    const config = readAuthConfig();
    if (config.mode !== 'backend' || !account) return null;
    return createFilesRuntime(
      config.apiBaseUrl,
      () => controller?.getState().session?.user.id ?? null,
      (destination) => router.push(fileDestinationHrefs[destination]),
      (parent) =>
        router.push(
          fileDestinationHrefs.files +
            (parent ? '?' + new URLSearchParams({ parent }).toString() : ''),
        ),
    );
  }, [controller, account, router]);
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
    return () => {
      void runtime.dispose().catch(() => setTransferFailure(true));
    };
  }, [runtime]);
  if (!runtime || !Media)
    return fileWorkspace ? (
      <main id="main-content">
        <StateSurface
          state="disabled"
          icon={<Cloud />}
          title={t('common.filesUnavailableTitle')}
          description={t('common.filesUnavailableDescription')}
        />
      </main>
    ) : (
      children
    );
  return (
    <FilesProvider
      key={account}
      port={runtime.port}
      media={Media}
      transfers={runtime.transfers}
      connections={runtime.connections}
      downloads={runtime.downloads}
      navigation={runtime.navigation}
    >
      <div
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault();
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          try {
            runtime.offer(Array.from(event.dataTransfer.files));
            setTransferFailure(false);
          } catch {
            setTransferFailure(true);
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
            setTransferFailure(false);
          } catch {
            setTransferFailure(true);
          }
        }}
      >
        {transferFailure ? (
          <p role="alert" className="p-4 text-danger">
            {t('common.fileTransferFailed')}
          </p>
        ) : null}
        {children}
      </div>
    </FilesProvider>
  );
}

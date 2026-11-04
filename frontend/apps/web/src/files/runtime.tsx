'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { FilesProvider, type FileMediaProps } from '@clouddrive/surface/files/runtime';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { Cloud } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { readAuthConfig } from '../auth/config';
import { AuthContext, useAuth } from '../auth/context';
import { FileAccountMenu } from './account-menu';
import { createFilesRuntime, fileDestinationHrefs } from './backend';
import { fileDestinationHref } from './destinations';
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
      (destination, query) => router.push(fileDestinationHref(destination, query)),
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
      <main id="main-content" tabIndex={-1} className="p-4">
        <Page>
          <PageHeader
            title={t('common.filesWorkspaceTitle')}
            description={t('common.filesWorkspaceDescription')}
          />
          <StateSurface
            state="disabled"
            icon={<Cloud />}
            title={t('common.filesUnavailableTitle')}
            description={t('common.filesUnavailableDescription')}
          />
        </Page>
      </main>
    ) : (
      children
    );
  return (
    <FilesProvider
      key={account}
      port={runtime.port}
      media={Media}
      accountTools={FileAccountMenu}
      transfers={runtime.transfers}
      connections={runtime.connections}
      downloads={runtime.downloads}
      navigation={runtime.navigation}
    >
      <div
        onDragOver={(event) => {
          if (fileWorkspace && event.dataTransfer.types.includes('Files')) event.preventDefault();
        }}
        onDrop={(event) => {
          if (!fileWorkspace || !event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          try {
            runtime.offer(Array.from(event.dataTransfer.files));
            setTransferFailure(false);
          } catch {
            setTransferFailure(true);
          }
        }}
        onPaste={(event) => {
          if (!fileWorkspace || !event.clipboardData?.files.length) return;
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

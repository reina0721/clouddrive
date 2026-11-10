'use client';
import { lazy, Suspense } from 'react';
import type { FileDocumentProps, FileEntry } from '@clouddrive/surface/files';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { FilesProvider, type FileMediaProps } from '@clouddrive/surface/files/runtime';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { Action } from '@clouddrive/ui-adapter/action';
import { Cloud, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSiteProfile } from '@clouddrive/surface/administration/runtime';
import { readAuthConfig } from '../auth/config';
import { AuthContext, useAuth } from '../auth/context';
import { FileAccountMenu } from './account-menu';
import { createFilesRuntime, fileDestinationHrefs } from './backend';
import { fileDestinationHref } from './destinations';
import { FileMediaView, type ImageToolsProps, type VideoToolsProps } from './media-view';
import type { MusicRequest } from './music-player';

const PDFReader = lazy(() =>
  import('./pdf/reader-view').then((module) => ({ default: module.PDFReaderView })),
);
const VideoSubtitles = lazy(() =>
  import('./video-subtitles').then((module) => ({ default: module.VideoSubtitles })),
);
const ImageEditor = lazy(() =>
  import('./image-editor').then((module) => ({ default: module.ImageEditor })),
);
const MusicPlayer = lazy(() =>
  import('./music-player').then((module) => ({ default: module.MusicPlayer })),
);
export function FilesRuntime({
  children,
  fileWorkspace,
}: Readonly<{ children: ReactNode; fileWorkspace: boolean }>) {
  const { t } = useFrontendTranslation();
  const controller = useContext(AuthContext);
  const account = useAuth().session?.user.id;
  const router = useRouter();
  const { profile } = useSiteProfile();
  const addresses = profile?.siteAddresses;
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
  const filePort = useMemo(
    () => runtime && (addresses ? runtime.withSiteAddresses(addresses) : runtime),
    [runtime, addresses],
  );
  const musicSequence = useRef(0);
  const [musicRequest, setMusicRequest] = useState<{
    runtime: NonNullable<typeof runtime>;
    sequence: number;
    playback: MusicRequest;
  }>();
  const playAudio = useCallback(
    (entry: FileEntry, maxBytes: number) => {
      if (!runtime) return;
      let consumed = false;
      setMusicRequest({
        runtime,
        sequence: ++musicSequence.current,
        playback: {
          entry,
          maxBytes,
          consumeAutoplay: () => {
            if (consumed) return false;
            consumed = true;
            return true;
          },
        },
      });
    },
    [runtime],
  );
  const Media = useMemo(() => {
    if (!runtime) return undefined;
    const { readMedia, subtitles, queueImageCopy } = runtime;
    function VideoTools({ entry, media }: VideoToolsProps) {
      return (
        <Suspense>
          <VideoSubtitles
            key={entry.id + ':' + entry.contentRevision}
            source={subtitles}
            entry={entry}
            media={media}
          />
        </Suspense>
      );
    }
    function ImageTools(props: ImageToolsProps) {
      const { t } = useFrontendTranslation();
      const [open, setOpen] = useState(false);
      const label = t('files.editImage');
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Action
            size="sm"
            variant="secondary"
            leadingIcon={<ImageIcon />}
            onPress={() => setOpen(true)}
          >
            {label}
          </Action>
          {open ? (
            <Suspense fallback={<p role="status">{t('files.mediaLoading')}</p>}>
              <ImageEditor {...props} queueCopy={queueImageCopy} onClose={() => setOpen(false)} />
            </Suspense>
          ) : null}
        </div>
      );
    }
    return function MediaRenderer(props: FileMediaProps) {
      return props.mode === 'preview' && props.version === undefined ? (
        <FileMediaView
          {...props}
          readContent={readMedia}
          videoTools={VideoTools}
          {...(props.imageCopyParentId !== undefined ? { imageTools: ImageTools } : {})}
        />
      ) : (
        <FileMediaView {...props} readContent={readMedia} />
      );
    };
  }, [runtime]);
  const Document = useMemo(
    () =>
      runtime
        ? function DocumentRenderer(props: FileDocumentProps) {
            return (
              <Suspense fallback={<p role="status">{props.entry.name}</p>}>
                <PDFReader {...props} readContent={runtime.readDocument} />
              </Suspense>
            );
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
  if (!runtime || !filePort || !Media || !Document)
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
      port={filePort.port}
      archives={runtime.archives}
      media={Media}
      pdfReader={Document}
      accountTools={FileAccountMenu}
      {...(fileWorkspace
        ? {
            music: {
              play: playAudio,
              player:
                musicRequest?.runtime === runtime ? (
                  <Suspense fallback={<p role="status">{t('files.mediaLoading')}</p>}>
                    <MusicPlayer
                      key={musicRequest.sequence}
                      request={musicRequest.playback}
                      listFiles={runtime.port.list}
                      readEntry={runtime.port.detail}
                      readMedia={runtime.readMedia}
                      onStop={() =>
                        setMusicRequest((current) =>
                          current === musicRequest ? undefined : current,
                        )
                      }
                    />
                  </Suspense>
                ) : null,
            },
          }
        : {})}
      transfers={runtime.transfers}
      connections={runtime.connections}
      downloads={runtime.downloads}
      navigation={filePort.navigation}
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

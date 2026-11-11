'use client';
import { lazy, Suspense } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { FileMedia } from '../../../src/files/runtime';
import { fileApplicationName } from '../../../src/files/file-applications';
import { ImageCopyDestinationDialog } from './own-folder-picker';
import { TextDialog } from './text-dialog';
import type { FileReaderController } from './use-file-reader';
const PdfDialog = lazy(() =>
  import('./pdf-dialog').then((module) => ({ default: module.PdfDialog })),
);
const EpubDialog = lazy(() =>
  import('./epub-dialog').then((module) => ({ default: module.EpubDialog })),
);
const ArchiveDialog = lazy(() =>
  import('./archive-dialog').then((module) => ({ default: module.ArchiveDialog })),
);
const WebFilePreviewDialog = lazy(() =>
  import('./web-file-preview-dialog').then((module) => ({ default: module.WebFilePreviewDialog })),
);
const DrawioDialog = lazy(() => import('./drawio-dialog'));

/** 单个阅读会话的呈现边界；真正的媒体和编辑资源仍由各 reader / Host 释放。 */
export function FileReader({ reader }: { reader: FileReaderController }) {
  const { t, locale } = useFrontendTranslation();
  const chinese = locale.startsWith('zh');
  const openWithLabel = chinese ? '打开方式' : 'Open with';
  const noApplicationLabel = chinese
    ? '此文件在当前设备上没有可用的浏览应用。'
    : 'No viewer is available for this file on this device.';
  const session = reader.session;
  const textEditor = session?.kind === 'text' ? session : undefined;
  const drawio = session?.kind === 'drawio' ? session : undefined;
  const pdfPreview = session?.kind === 'pdf' ? session : undefined;
  const epubEntry = session?.kind === 'epub' ? session.entry : undefined;
  const archiveEntry = session?.kind === 'archive' ? session.entry : undefined;
  const mediaPreview = session?.kind === 'media' ? session : undefined;
  const webPreview = session?.kind === 'web' ? session : undefined;
  const applicationPicker = session?.kind === 'selecting' && session.visible ? session : undefined;
  const album = mediaPreview?.album;
  const imagePreview = album !== undefined;
  const videoPreview =
    mediaPreview?.videoPlaylist || mediaPreview?.entry.mediaType.startsWith('video/');
  return (
    <>
      {textEditor ? (
        <TextDialog
          {...textEditor}
          {...(textEditor.request.mode === 'edit'
            ? {
                onDownload: () => {
                  if (textEditor.request.mode === 'edit')
                    void reader.download(textEditor.request.entry);
                },
              }
            : {})}
          onClose={() => reader.close()}
          onSaved={reader.saved}
        />
      ) : null}
      {drawio ? (
        <Suspense fallback={<p role="status">{t('files.mediaLoading')}</p>}>
          <DrawioDialog {...drawio} onClose={() => reader.close()} onSaved={reader.changed} />
        </Suspense>
      ) : null}
      {pdfPreview ? (
        <Suspense fallback={<p role="status">{pdfPreview.entry.name}</p>}>
          <PdfDialog {...pdfPreview} onClose={() => reader.close()} />
        </Suspense>
      ) : null}
      {epubEntry ? (
        <Suspense fallback={<p role="status">{epubEntry.name}</p>}>
          <EpubDialog
            key={`${epubEntry.id}:${epubEntry.contentRevision}`}
            entry={epubEntry}
            onClose={() => reader.close()}
            onDownload={() => void reader.download(epubEntry)}
          />
        </Suspense>
      ) : null}
      {mediaPreview ? (
        <DialogSurface
          triggerLabel={t('files.mediaPreview')}
          title={mediaPreview.entry.name}
          description={t('files.mediaPreview')}
          cancelLabel={t('files.close')}
          size={videoPreview || imagePreview ? 'cover' : 'lg'}
          layout={videoPreview || imagePreview ? 'workspace' : 'standard'}
          isOpen
          onOpenChange={(open) => {
            if (!open) reader.close();
          }}
        >
          <div className={videoPreview ? 'flex h-full min-h-0 flex-col gap-4' : 'space-y-4'}>
            {album ? (
              // eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions -- 事件只从可聚焦的导航按钮冒泡。
              <div
                role="group"
                aria-label={locale.startsWith('zh') ? '照片导航' : 'Photo navigation'}
                className="flex flex-wrap items-center gap-2"
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                  event.preventDefault();
                  reader.moveImage(event.key === 'ArrowLeft' ? -1 : 1);
                }}
              >
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={album.index === 0}
                  onPress={() => reader.moveImage(-1)}
                >
                  {locale.startsWith('zh') ? '上一张' : 'Previous photo'}
                </Action>
                <p role="status" className="text-sm text-ink-muted">
                  {album.index + 1} / {album.entries.length}
                </p>
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={album.index + 1 >= album.entries.length}
                  onPress={() => reader.moveImage(1)}
                >
                  {locale.startsWith('zh') ? '下一张' : 'Next photo'}
                </Action>
                <Action
                  size="sm"
                  variant="secondary"
                  onPress={() => void reader.download(mediaPreview.entry)}
                >
                  {t('files.download')}
                </Action>
              </div>
            ) : null}
            {mediaPreview.savedImageVersion ? (
              <p role="status" className="text-sm text-ink-muted">
                {locale.startsWith('zh')
                  ? '已保存图片新版本。'
                  : 'The new image version was saved.'}
              </p>
            ) : null}
            <FileMedia
              key={mediaPreview.entry.id + ':' + mediaPreview.entry.contentRevision}
              entry={mediaPreview.entry}
              mode="preview"
              maxBytes={mediaPreview.maxBytes}
              {...(mediaPreview.videoPlaylist
                ? { videoPlaylist: { download: () => void reader.download(mediaPreview.entry) } }
                : {})}
              {...(mediaPreview.entry.kind === 'file' && mediaPreview.entry.trashedAt === null
                ? {
                    imageEditing: {
                      entry: mediaPreview.entry,
                      destinationPicker: ImageCopyDestinationDialog,
                      onVersionPublished: reader.refreshPublishedImage,
                    },
                  }
                : {})}
            />
            {!mediaPreview.videoPlaylist && !imagePreview ? (
              <div className="shrink-0">
                <Action
                  variant="secondary"
                  onPress={() => void reader.download(mediaPreview.entry)}
                >
                  {t('files.download')}
                </Action>
              </div>
            ) : null}
          </div>
        </DialogSurface>
      ) : null}
      {archiveEntry ? (
        <Suspense fallback={<p role="status">{t('files.previewLoading')}</p>}>
          <ArchiveDialog
            entry={archiveEntry}
            onClose={() => reader.close()}
            onChanged={reader.changed}
          />
        </Suspense>
      ) : null}
      {applicationPicker ? (
        <DialogSurface
          triggerLabel={openWithLabel}
          title={openWithLabel}
          description={applicationPicker.entry.name}
          cancelLabel={t('files.close')}
          isOpen
          onOpenChange={(open) => {
            if (!open) {
              reader.close();
            }
          }}
        >
          <div className="space-y-4">
            {applicationPicker.error ? (
              <p role="alert">{applicationPicker.error}</p>
            ) : !applicationPicker.options ? (
              <p role="status">{t('files.previewLoading')}</p>
            ) : applicationPicker.options.length === 0 && !applicationPicker.webOptions?.length ? (
              <p role="status">{noApplicationLabel}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {applicationPicker.options.map((id) => (
                  <Action
                    key={id}
                    variant="secondary"
                    onPress={() => {
                      reader.choose(id);
                    }}
                  >
                    {fileApplicationName(id, chinese)}
                  </Action>
                ))}
                {applicationPicker.webOptions?.map((application) => (
                  <Action
                    key={application.id}
                    variant="secondary"
                    onPress={() => {
                      reader.chooseWeb(application);
                    }}
                  >
                    {application.name}
                  </Action>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {applicationPicker.error ? (
                <Action
                  variant="secondary"
                  onPress={() => void reader.open(applicationPicker.entry, 'choose')}
                >
                  {t('files.retry')}
                </Action>
              ) : null}
              <Action
                variant="secondary"
                onPress={() => void reader.download(applicationPicker.entry)}
              >
                {t('files.download')}
              </Action>
            </div>
          </div>
        </DialogSurface>
      ) : null}
      {webPreview ? (
        <Suspense fallback={<p role="status">{t('files.previewLoading')}</p>}>
          <WebFilePreviewDialog
            entry={webPreview.entry}
            application={webPreview.application}
            onClose={() => reader.close()}
          />
        </Suspense>
      ) : null}
    </>
  );
}

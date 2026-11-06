import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FilesError, type FileEntry } from '@clouddrive/surface/files';
import { FileMediaView } from './media-view';

vi.mock('@clouddrive/i18n', () => {
  const t = (key: string) => key;
  return { useFrontendTranslation: () => ({ t }) };
});
vi.mock('./media-signatures', () => ({ rasterType: () => Promise.resolve('image/png') }));

const entry: FileEntry = {
  id: 'media',
  parentId: '',
  name: 'image.png',
  kind: 'file',
  sizeBytes: 3,
  mediaType: 'image/png',
  createdAt: '',
  updatedAt: '',
  trashedAt: null,
  contentRevision: 1,
};
type Reader = Parameters<typeof FileMediaView>[0]['readContent'];
describe('媒体失败语义与恢复', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'URL',
      class extends URL {
        static override createObjectURL() {
          return 'blob:test-media';
        }
        static override revokeObjectURL() {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  it('缩略图网络繁忙不误报格式损坏，并可重试恢复真实内容', async () => {
    const read = vi
      .fn<Reader>()
      .mockRejectedValueOnce(new FilesError('busy'))
      .mockResolvedValue(new Blob(['png']));
    render(<FileMediaView entry={entry} mode="thumbnail" maxBytes={10} readContent={read} />);
    await screen.findByText('files.errors.busy');
    expect(screen.queryByText('files.mediaUnsupported')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'files.retry' }));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: entry.name })).toHaveAttribute(
        'src',
        'blob:test-media',
      ),
    );
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('内容版本变化会清除旧错误，不把之前的失败留在新内容上', async () => {
    const read = vi
      .fn<Reader>()
      .mockRejectedValueOnce(new FilesError('unsupported'))
      .mockResolvedValue(new Blob(['png']));
    const view = render(
      <FileMediaView entry={entry} mode="thumbnail" maxBytes={10} readContent={read} />,
    );
    await screen.findByText('files.mediaUnsupported');
    view.rerender(
      <FileMediaView
        entry={{ ...entry, contentRevision: 2 }}
        mode="thumbnail"
        maxBytes={10}
        readContent={read}
      />,
    );
    await screen.findByRole('img', { name: entry.name });
    expect(screen.queryByText('files.mediaUnsupported')).toBeNull();
  });
  it('取消旧读取不会覆盖新版本的成功结果', async () => {
    let firstSignal: AbortSignal | undefined;
    const read = vi
      .fn<Reader>()
      .mockImplementationOnce((_id, _bytes, signal) => {
        firstSignal = signal;
        return new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new FilesError('canceled')), {
            once: true,
          }),
        );
      })
      .mockResolvedValue(new Blob(['png']));
    const view = render(
      <FileMediaView entry={entry} mode="thumbnail" maxBytes={10} readContent={read} />,
    );
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    view.rerender(
      <FileMediaView
        entry={{ ...entry, contentRevision: 2 }}
        mode="thumbnail"
        maxBytes={10}
        readContent={read}
      />,
    );
    await screen.findByRole('img', { name: entry.name });
    expect(firstSignal?.aborted).toBe(true);
    expect(screen.queryByText('files.errors.canceled')).toBeNull();
  });
});

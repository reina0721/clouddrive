import { FilesError } from '@clouddrive/surface/files';

/** nativeDownload 交由浏览器处理响应，不在页面内建立完整文件 Blob。 */
export function nativeDownload(path: string, name: string) {
  const url = new URL(path, location.origin);
  if (url.origin !== location.origin) throw new FilesError('unsupported');
  const link = document.createElement('a');
  link.href = url.href;
  link.download = name;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.append(link);
  link.click();
  link.remove();
}

/** downloadBlob 仅保存已有有界产物，浏览器接管后释放本次自有URL。 */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

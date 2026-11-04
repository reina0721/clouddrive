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

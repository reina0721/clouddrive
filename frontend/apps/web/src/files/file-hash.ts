import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { FilesError } from '@clouddrive/surface/files';

/** hashFile 逐块计算同内容身份，不把大文件整体复制到 JS 堆。 */
export async function hashFile(
  file: File,
  chunkBytes: number,
  signal: AbortSignal,
  onProgress: (bytes: number) => void,
): Promise<string> {
  const digest = sha256.create();
  try {
    for (let offset = 0; offset < file.size; offset += chunkBytes) {
      if (signal.aborted) throw new FilesError('canceled');
      const block = new Uint8Array(await file.slice(offset, offset + chunkBytes).arrayBuffer());
      if (signal.aborted) throw new FilesError('canceled');
      digest.update(block);
      onProgress(offset + block.byteLength);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    if (signal.aborted) throw new FilesError('canceled');
    return bytesToHex(digest.digest());
  } finally {
    digest.destroy();
  }
}

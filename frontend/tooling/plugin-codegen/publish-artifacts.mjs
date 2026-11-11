import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import writeFileAtomic from 'write-file-atomic';

/** Unchanged modules keep their inode/mtime, so a reconcile does not invalidate Next or tsc. */
export async function publishArtifacts(artifacts) {
  for (const { path, content } of artifacts) {
    let actual;
    try {
      actual = await readFile(path, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (actual === content) continue;
    await mkdir(dirname(path), { recursive: true });
    // Readers see a complete old or new module, never a missing/truncated module.
    // This is per-file publication, not a transaction across the artifact graph.
    await writeFileAtomic(path, content, { encoding: 'utf8' });
  }
}

/** write-file-atomic@7 reserves `<module>.ts[x].<uint32>` beside a module. */
export function isPublicationTemporaryFile(path) {
  return /\.tsx?\.\d+$/.test(path);
}

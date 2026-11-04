import {
  FilesError,
  fileClipboardMaxEntries,
  type FilesPort,
  type FileClipboardPort,
  type FileClipboardSnapshot,
  type FilePasteResult,
} from '@clouddrive/surface/files';

/** createFileClipboard 将有限待处理目录项留在单账号运行域，不写系统剪贴板或磁盘。 */
export function createFileClipboard(
  assertCurrent: () => void,
  operations: Pick<FilesPort, 'detail' | 'copy' | 'update'>,
) {
  const listeners = new Set<() => void>();
  const empty: FileClipboardSnapshot = Object.freeze({
    mode: 'copy',
    entries: Object.freeze([]),
    pending: false,
  });
  let snapshot: FileClipboardSnapshot = empty;
  let disposed = false;
  let epoch = 0;
  const publish = (next: FileClipboardSnapshot) => {
    snapshot = Object.freeze({ ...next, entries: Object.freeze([...next.entries]) });
    for (const listener of listeners) listener();
  };
  const writable = () => {
    assertCurrent();
    if (disposed) throw new FilesError('canceled');
    if (snapshot.pending) throw new FilesError('busy');
  };
  const port: FileClipboardPort = {
    subscribe: (listener) => {
      assertCurrent();
      if (disposed) throw new FilesError('canceled');
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => {
      if (disposed) return empty;
      try {
        assertCurrent();
      } catch (error) {
        // 外部store读取在账号切换的卸载窗口也会发生，只返回稳定空值，不能暴露旧账号名称。
        if (error instanceof FilesError && error.code === 'canceled') return empty;
        throw error;
      }
      return snapshot;
    },
    set: (mode, entries) => {
      writable();
      if (!entries.length || entries.length > fileClipboardMaxEntries)
        throw new FilesError('large');
      if (
        !['copy', 'cut'].includes(mode) ||
        new Set(entries.map((entry) => entry.id)).size !== entries.length ||
        entries.some(
          (entry) => !entry.id || !entry.name || !['file', 'folder'].includes(entry.kind),
        )
      )
        throw new FilesError('invalid');
      publish({
        mode,
        entries: entries.map((entry) =>
          Object.freeze({ id: entry.id, name: entry.name, kind: entry.kind }),
        ),
        pending: false,
      });
    },
    clear: () => {
      writable();
      publish({ mode: 'copy', entries: [], pending: false });
    },
    paste: async (destination) => {
      writable();
      if (!snapshot.entries.length) throw new FilesError('invalid');
      const original = snapshot;
      const currentEpoch = epoch;
      const check = () => {
        assertCurrent();
        if (disposed || epoch !== currentEpoch) throw new FilesError('canceled');
      };
      publish({ ...original, pending: true });
      const failures: { entry: (typeof original.entries)[number]; error: unknown }[] = [];
      let completed = 0;
      try {
        // 先完成全部源与目的地的可见性/祖先核验，再执行任何写入。
        const target = destination ? await operations.detail(destination) : undefined;
        check();
        if (target && target.entry.kind !== 'folder') throw new FilesError('invalid');
        const sources = [];
        for (const item of original.entries) {
          const current = await operations.detail(item.id);
          check();
          if (
            current.entry.kind === 'shortcut' ||
            current.entry.trashedAt ||
            current.entry.id !== item.id
          )
            throw new FilesError('invalid');
          if (
            destination === item.id ||
            target?.breadcrumbs.some((parent) => parent.id === item.id)
          )
            throw new FilesError('invalid');
          if (
            current.breadcrumbs.some((parent) =>
              original.entries.some((item) => item.id === parent.id),
            )
          )
            throw new FilesError('invalid');
          if (original.mode === 'cut' && current.entry.parentId === destination)
            throw new FilesError('invalid');
          sources.push(current.entry);
        }
        for (const source of sources) {
          check();
          try {
            if (original.mode === 'copy')
              await operations.copy(source.id, destination, source.name);
            else await operations.update(source.id, { parentId: destination });
            check();
            completed++;
            if (original.mode === 'cut')
              publish({
                ...snapshot,
                entries: snapshot.entries.filter((item) => item.id !== source.id),
              });
          } catch (error) {
            check();
            if (error instanceof FilesError && error.code === 'canceled') throw error;
            failures.push({
              entry: original.entries.find((item) => item.id === source.id)!,
              error,
            });
          }
        }
        return { completed, failures } satisfies FilePasteResult;
      } finally {
        // dispose会先清空；旧异步调用不能把旧账号队列重新写回。
        if (!disposed && epoch === currentEpoch) publish({ ...snapshot, pending: false });
      }
    },
  };
  return {
    port,
    activate: () => {
      disposed = false;
    },
    dispose: () => {
      disposed = true;
      epoch++;
      publish({ mode: 'copy', entries: [], pending: false });
      listeners.clear();
    },
  };
}

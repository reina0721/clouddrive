'use client';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { FilesPort } from '../../../src/files/model';
import { createDirectoryTreeController } from '../stores/directory-tree';

export function useDirectoryTree(
  port: FilesPort,
  revision: string,
  parent: string | undefined,
  automatic: boolean,
) {
  const controller = useMemo(() => createDirectoryTreeController(port), [port]);
  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);
  useEffect(() => {
    controller.synchronize({ revision, parent, automatic });
  }, [controller, revision, parent, automatic]);
  const snapshot = useSyncExternalStore(
    controller.store.subscribe,
    controller.store.getState,
    controller.store.getInitialState,
  );
  return { controller, snapshot };
}

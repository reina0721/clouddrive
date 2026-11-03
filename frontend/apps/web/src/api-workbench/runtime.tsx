'use client';

import { useState, type ReactNode } from 'react';
import {
  ApiWorkbenchProvider,
  type ApiWorkbenchPort,
  type ResolvedRequest,
  type TaskDefinition,
  type WorkspaceSnapshot,
} from '@clouddrive/surface/api-workbench';

export function ApiWorkbenchRuntime({ children }: Readonly<{ children: ReactNode }>) {
  const [port] = useState<ApiWorkbenchPort>(() => {
    let service: ApiWorkbenchPort | null = null;
    let servicePromise: Promise<ApiWorkbenchPort> | null = null;
    const getService = () => {
      if (!servicePromise) {
        servicePromise = import('./resolve-service')
          .then(({ resolveService }) => resolveService())
          .then((resolved) => {
            service = resolved;
            return resolved;
          });
      }
      return servicePromise;
    };

    return {
      get capabilities() {
        return (
          service?.capabilities ?? {
            mode: 'mock',
            disguise: false,
            corsFree: false,
            persistentTasks: false,
          }
        );
      },
      transfer: {
        selectWorkspace: async () => (await getService()).transfer.selectWorkspace(),
        exportWorkspace: async (snapshot) =>
          (await getService()).transfer.exportWorkspace(snapshot),
        copyResponse: async (body) => (await getService()).transfer.copyResponse(body),
      },
      workspace: {
        load: async (): Promise<WorkspaceSnapshot> => (await getService()).workspace.load(),
        save: async (snap: WorkspaceSnapshot): Promise<void> =>
          (await getService()).workspace.save(snap),
        clearHistory: async (): Promise<void> => (await getService()).workspace.clearHistory(),
        getUsage: async () => (await getService()).workspace.getUsage(),
      },
      transport: {
        execute: async (req: ResolvedRequest, signal?: AbortSignal) =>
          (await getService()).transport.execute(req, signal),
      },
      tasks: {
        list: async (): Promise<readonly TaskDefinition[]> => (await getService()).tasks.list(),
        upsert: async (task: TaskDefinition): Promise<void> =>
          (await getService()).tasks.upsert(task),
        remove: async (id: string): Promise<void> => (await getService()).tasks.remove(id),
      },
    };
  });

  return <ApiWorkbenchProvider port={port}>{children}</ApiWorkbenchProvider>;
}

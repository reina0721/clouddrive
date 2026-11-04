'use client';
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createAppStore } from '@clouddrive/state-foundation';
type WorkspaceState = {
  revision: number;
  setRevision: (update: (revision: number) => number) => void;
};
function createWorkspaceStore() {
  return createAppStore<WorkspaceState>((set) => ({
    revision: 0,
    setRevision: (update) => set((state) => ({ revision: update(state.revision) })),
  }));
}
const Context = createContext<ReturnType<typeof createWorkspaceStore> | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createWorkspaceStore);
  return <Context value={store}>{children}</Context>;
}
export function useWorkspaceRevision() {
  const store = useContext(Context);
  if (!store) throw new Error('File workspace is required');
  return [store((state) => state.revision), store((state) => state.setRevision)] as const;
}

export const WorkspaceCreateContext = createContext<
  ((action: 'folder' | 'text' | 'markdown') => void) | null
>(null);
export function useWorkspaceCreate() {
  const action = useContext(WorkspaceCreateContext);
  if (!action) throw new Error('Workspace actions required');
  return action;
}

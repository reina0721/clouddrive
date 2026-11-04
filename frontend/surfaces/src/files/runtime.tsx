'use client';
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
  type ComponentType,
} from 'react';
import type { TransfersPort } from './transfers';
import type { ConnectionsPort } from './connections';
import type { FilesPort, PublicFilesPort, FileEntry } from './model';

export type FileMediaProps = Readonly<{
  entry: FileEntry;
  mode: 'preview' | 'thumbnail';
  maxBytes: number;
}>;
const MediaContext = createContext<ComponentType<FileMediaProps> | null>(null);

const Context = createContext<FilesPort | null>(null);
const TransfersContext = createContext<TransfersPort | null>(null);
const ConnectionsContext = createContext<ConnectionsPort | null>(null);
export function FilesProvider({
  port,
  children,
  media: Media,
  transfers,
  connections,
}: Readonly<{
  port: FilesPort;
  transfers: TransfersPort;
  connections: ConnectionsPort;
  children: ReactNode;
  media: ComponentType<FileMediaProps>;
}>) {
  return (
    <Context value={port}>
      <TransfersContext value={transfers}>
        <ConnectionsContext value={connections}>
          <MediaContext value={Media}>{children}</MediaContext>
        </ConnectionsContext>
      </TransfersContext>
    </Context>
  );
}

export function useConnections() {
  const port = useContext(ConnectionsContext);
  if (!port) throw new Error('File connections runtime is required');
  return port;
}

export function useTransfers() {
  const port = useContext(TransfersContext);
  if (!port) throw new Error('Transfer runtime is required');
  return port;
}
export function useTransferSnapshot() {
  const port = useTransfers();
  return useSyncExternalStore(port.subscribe, port.getSnapshot, port.getSnapshot);
}
export function useFileMedia() {
  const renderer = useContext(MediaContext);
  if (!renderer) throw new Error('File media renderer is required');
  return renderer;
}
export function useFiles(): FilesPort {
  const port = useContext(Context);
  if (!port) throw new Error('Files runtime is required');
  return port;
}

const PublicContext = createContext<PublicFilesPort | null>(null);
export function PublicFilesProvider({
  port,
  children,
}: Readonly<{ port: PublicFilesPort; children: ReactNode }>) {
  return <PublicContext value={port}>{children}</PublicContext>;
}
export function usePublicFiles(): PublicFilesPort {
  const port = useContext(PublicContext);
  if (!port) throw new Error('Public files runtime is required');
  return port;
}

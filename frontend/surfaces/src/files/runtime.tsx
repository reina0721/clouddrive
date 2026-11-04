'use client';
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react';
import type { ConnectionsPort } from './connections';
import type { DownloadsPort } from './downloads';
import type { FileEntry, FilesPort, PublicFilesPort } from './model';
import type { NavigationPort } from './navigation';
import type { TransfersPort } from './transfers';
export { loadFileAnnotationMessages, loadPublicFileMessages } from './messages';

export type FileMediaProps = Readonly<{
  entry: Pick<FileEntry, 'id' | 'name' | 'mediaType' | 'sizeBytes' | 'contentRevision'>;
  mode: 'preview' | 'thumbnail';
  maxBytes: number;
  version?: number;
  labels?: Readonly<{ loading: string; unsupported: string; tooLarge: string; retry: string }>;
}>;
const AccountToolsContext = createContext<ComponentType | null>(null);
const MediaContext = createContext<ComponentType<FileMediaProps> | null>(null);

const Context = createContext<FilesPort | null>(null);
const TransfersContext = createContext<TransfersPort | null>(null);
const DownloadsContext = createContext<DownloadsPort | null>(null);
const ConnectionsContext = createContext<ConnectionsPort | null>(null);
const NavigationContext = createContext<NavigationPort | null>(null);
export function FilesProvider({
  port,
  children,
  media: Media,
  accountTools: AccountTools,
  transfers,
  downloads,
  connections,
  navigation,
}: Readonly<{
  port: FilesPort;
  transfers: TransfersPort;
  downloads: DownloadsPort;
  connections: ConnectionsPort;
  navigation: NavigationPort;
  children: ReactNode;
  media: ComponentType<FileMediaProps>;
  accountTools: ComponentType;
}>) {
  return (
    <Context value={port}>
      <TransfersContext value={transfers}>
        <ConnectionsContext value={connections}>
          <NavigationContext value={navigation}>
            <DownloadsContext value={downloads}>
              <MediaContext value={Media}>
                <AccountToolsContext value={AccountTools}>{children}</AccountToolsContext>
              </MediaContext>
            </DownloadsContext>
          </NavigationContext>
        </ConnectionsContext>
      </TransfersContext>
    </Context>
  );
}

export function useFileNavigation() {
  const port = useContext(NavigationContext);
  if (!port) throw new Error('File navigation runtime is required');
  return port;
}

export function useConnections() {
  const port = useContext(ConnectionsContext);
  if (!port) throw new Error('File connections runtime is required');
  return port;
}

export function useDownloads() {
  const port = useContext(DownloadsContext);
  if (!port) throw new Error('Offline downloads runtime is required');
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
/** FileMedia 通过稳定组件入口使用Host注入的renderer，避免调用方在render期间创建组件。 */
export function FileMedia(props: FileMediaProps) {
  const renderer = useContext(MediaContext);
  if (!renderer) throw new Error('File media renderer is required');
  return createElement(renderer, props);
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
  media: Media,
}: Readonly<{ port: PublicFilesPort; children: ReactNode; media: ComponentType<FileMediaProps> }>) {
  return (
    <PublicContext value={port}>
      <MediaContext value={Media}>{children}</MediaContext>
    </PublicContext>
  );
}
export function usePublicFiles(): PublicFilesPort {
  const port = useContext(PublicContext);
  if (!port) throw new Error('Public files runtime is required');
  return port;
}

export function FileAccountTools() {
  const renderer = useContext(AccountToolsContext);
  if (!renderer) throw new Error('File account tools renderer is required');
  return createElement(renderer);
}

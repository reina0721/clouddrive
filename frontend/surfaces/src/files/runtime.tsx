'use client';
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode, type ComponentType } from 'react';
import type { FilesPort, PublicFilesPort, FileEntry } from './model';

export type FileMediaProps = Readonly<{
  entry: FileEntry;
  mode: 'preview' | 'thumbnail';
  maxBytes: number;
}>;
const MediaContext = createContext<ComponentType<FileMediaProps> | null>(null);

const Context = createContext<FilesPort | null>(null);
export function FilesProvider({
  port,
  children,
  media: Media,
}: Readonly<{ port: FilesPort; children: ReactNode; media: ComponentType<FileMediaProps> }>) {
  return (
    <Context value={port}>
      <MediaContext value={Media}>{children}</MediaContext>
    </Context>
  );
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

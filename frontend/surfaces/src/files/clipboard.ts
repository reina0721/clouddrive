import type { FileEntry } from './model';

export const fileClipboardMaxEntries = 100;
export type FileClipboardMode = 'copy' | 'cut';
export type FileClipboardEntry = Readonly<Pick<FileEntry, 'id' | 'name' | 'kind'>>;
export type FileClipboardSnapshot = Readonly<{
  mode: FileClipboardMode;
  entries: readonly FileClipboardEntry[];
  pending: boolean;
}>;
export type FilePasteResult = Readonly<{
  completed: number;
  failures: readonly { entry: FileClipboardEntry; error: unknown }[];
}>;
export type FileClipboardPort = Readonly<{
  subscribe(listener: () => void): () => void;
  getSnapshot(): FileClipboardSnapshot;
  set(mode: FileClipboardMode, entries: readonly FileClipboardEntry[]): void;
  clear(): void;
  paste(destination: string): Promise<FilePasteResult>;
}>;

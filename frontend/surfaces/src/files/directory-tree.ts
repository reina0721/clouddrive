import type { FileEntry, FileListing, FileQuery, FilesErrorCode } from './model';

export type DirectoryTreeReader = (
  query: FileQuery,
  signal: AbortSignal,
) => Promise<Pick<FileListing, 'items' | 'breadcrumbs' | 'page' | 'pageSize' | 'total'>>;

export const directoryTreeRoot = 'files-directory-root';
export const directoryTreePageSize = 50;
export const maxDirectoryTreeFolders = 1000;
export const maxAutomaticTreeBranches = 20;
export type DirectoryTreeFailure = FilesErrorCode | 'budget' | '';
export type DirectoryBranch = Readonly<{
  items: readonly string[];
  page: number;
  total: number;
  phase: 'idle' | 'loading' | 'ready' | 'failed';
  failure: DirectoryTreeFailure;
  failedPage: number;
}>;
export type DirectoryTreeSnapshot = Readonly<{
  ready: boolean;
  rootOpen: boolean;
  expanded: ReadonlySet<string>;
  folders: ReadonlyMap<string, FileEntry>;
  branches: ReadonlyMap<string, DirectoryBranch>;
  pathChildren: ReadonlyMap<string, readonly string[]>;
  following: boolean;
  pathFailure: DirectoryTreeFailure;
}>;
export function emptyDirectoryBranch(): DirectoryBranch {
  return { items: [], page: 0, total: 0, phase: 'idle', failure: '', failedPage: 1 };
}
export function initialDirectoryTree(): DirectoryTreeSnapshot {
  return {
    ready: false,
    rootOpen: false,
    expanded: new Set(),
    folders: new Map(),
    branches: new Map(),
    pathChildren: new Map(),
    following: false,
    pathFailure: '',
  };
}
export function directoryChildren(snapshot: DirectoryTreeSnapshot, parent: string): string[] {
  return [
    ...new Set([
      ...(snapshot.branches.get(parent)?.items ?? []),
      ...(snapshot.pathChildren.get(parent) ?? []),
    ]),
  ];
}

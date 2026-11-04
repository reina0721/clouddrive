'use client';
import { lazy, Suspense, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { WorkspaceProvider } from '../stores/workspace';
const FileWorkspace = lazy(() =>
  import('../src/file-workspace').then((module) => ({ default: module.FileWorkspace })),
);
function WorkspaceRoute({ children }: { children: ReactNode }) {
  const pathname = usePathname(),
    params = useSearchParams();
  return (
    <FileWorkspace
      pathname={pathname}
      query={{
        parent: params.get('parent') ?? '',
        category: params.get('category') ?? '',
        trash: params.get('trash') ?? '',
        search: params.get('search') ?? '',
        filter: params.get('filter') ?? '',
        page: params.get('page') ?? '',
      }}
    >
      {children}
    </FileWorkspace>
  );
}
export default function FilesLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <Suspense>
        <WorkspaceRoute>{children}</WorkspaceRoute>
      </Suspense>
    </WorkspaceProvider>
  );
}

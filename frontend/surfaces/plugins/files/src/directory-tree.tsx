'use client';
import { useEffect, useRef } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField } from '@clouddrive/ui-adapter/form-field';
import { Tree, type TreeNode } from '@clouddrive/ui-adapter/tree';
import { FileGlyph } from '../../../src/files/icons';
import { useFiles } from '../../../src/files/runtime';
import {
  directoryChildren,
  directoryTreeRoot,
  directoryTreePageSize,
  emptyDirectoryBranch,
  type DirectoryTreeFailure,
  type DirectoryTreeSnapshot,
} from '../../../src/files/directory-tree';
import type { createDirectoryTreeController } from '../stores/directory-tree';

const loadPrefix = 'load-directory:';

export function DirectoryTree({
  snapshot,
  controller,
  currentParent,
  automatic,
  onAutomaticChange,
  onNavigate,
}: {
  snapshot: DirectoryTreeSnapshot;
  controller: ReturnType<typeof createDirectoryTreeController>;
  currentParent: string | undefined;
  automatic: boolean;
  onAutomaticChange: (value: boolean) => void;
  onNavigate: () => void;
}) {
  const { t } = useFrontendTranslation();
  const port = useFiles();
  const lastNavigation = useRef<string | undefined>(undefined);
  useEffect(() => {
    lastNavigation.current = undefined;
  }, [currentParent]);
  const errorText = (failure: DirectoryTreeFailure) =>
    failure === 'budget'
      ? t('files.tree.budget')
      : failure === 'conflict'
        ? t('files.tree.changed')
        : t('files.errors.' + failure);
  function nodesFor(parent: string, ancestors: ReadonlySet<string>): TreeNode[] {
    const branch = snapshot.branches.get(parent) ?? emptyDirectoryBranch();
    const nextPage =
      branch.phase === 'failed' || branch.phase === 'loading' ? branch.failedPage : branch.page + 1;
    const operationId = loadPrefix + nextPage + ':' + parent;
    const nodes: TreeNode[] = directoryChildren(snapshot, parent).flatMap((id) => {
      const folder = snapshot.folders.get(id);
      if (
        !folder ||
        ancestors.has(id) ||
        folder.parentId !== (parent === directoryTreeRoot ? '' : parent)
      )
        return [];
      const child = snapshot.branches.get(id) ?? emptyDirectoryBranch();
      const hasChildren =
        child.phase !== 'ready' ||
        directoryChildren(snapshot, id).length > 0 ||
        child.items.length < child.total;
      return [
        {
          id,
          label: folder.name,
          leadingIcon: <FileGlyph kind="folder" mediaType="" size="small" />,
          hasChildItems: hasChildren,
          ...(!branch.items.includes(id) ? { description: t('files.tree.path') } : {}),
          children: snapshot.expanded.has(id) ? nodesFor(id, new Set([...ancestors, id])) : [],
        },
      ];
    });
    if (branch.phase === 'loading')
      nodes.push({ id: operationId, label: t('files.tree.loading'), disabled: true });
    else if (branch.phase === 'failed')
      nodes.push({
        id: operationId,
        label: t('files.tree.failed', { reason: errorText(branch.failure) }),
        description: t('files.tree.retry'),
      });
    else if (branch.phase === 'idle') nodes.push({ id: operationId, label: t('files.tree.load') });
    else if (branch.page * directoryTreePageSize < branch.total)
      nodes.push({
        id: operationId,
        label: t('files.tree.more', { count: branch.items.length, total: branch.total }),
      });
    return nodes;
  }
  function activate(id: string) {
    if (id.startsWith(loadPrefix)) {
      const value = id.slice(loadPrefix.length);
      const split = value.indexOf(':');
      if (split > 0)
        void controller.loadNext(value.slice(split + 1), Number(value.slice(0, split)));
      return;
    }
    if (!snapshot.folders.has(id)) return;
    if (lastNavigation.current === id) return;
    lastNavigation.current = id;
    port.navigate('files', { parent: id });
    onNavigate();
  }
  const nodes = nodesFor(directoryTreeRoot, new Set());
  return (
    <section aria-label={t('files.tree.title')} className="space-y-2 py-2" data-file-directory-tree>
      <div className="flex flex-wrap items-center gap-1">
        <CheckboxField
          label={t('files.tree.automatic')}
          checked={automatic}
          onCheckedChange={onAutomaticChange}
        />
        <Action
          size="sm"
          variant="quiet"
          onPress={() => {
            void controller.refresh();
          }}
        >
          {t('files.tree.refresh')}
        </Action>
      </div>
      <p className="text-xs text-ink-muted">{t('files.tree.deviceHint')}</p>
      {snapshot.following ? (
        <p role="status" className="text-xs text-ink-muted">
          {t('files.tree.following')}
        </p>
      ) : null}
      {snapshot.pathFailure ? (
        <div role="alert" className="space-y-2 text-xs text-danger">
          <p>{t('files.tree.failed', { reason: errorText(snapshot.pathFailure) })}</p>
          <Action size="sm" variant="quiet" onPress={controller.retryPath}>
            {t('files.tree.retryPath')}
          </Action>
        </div>
      ) : null}
      <div className="max-h-64 max-w-full overflow-auto">
        {nodes.length ? (
          <Tree
            label={t('files.tree.title')}
            nodes={nodes}
            density="compact"
            selectionMode="single"
            selectionBehavior="replace"
            activationBehavior="press"
            selectedIds={new Set(currentParent ? [currentParent] : [])}
            expandedIds={snapshot.expanded}
            onExpandedChange={controller.expand}
            onAction={activate}
            expandLabel={t('files.tree.expand')}
            collapseLabel={t('files.tree.collapse')}
          />
        ) : (
          <p role="status" className="text-xs text-ink-muted">
            {t('files.tree.empty')}
          </p>
        )}
      </div>
    </section>
  );
}

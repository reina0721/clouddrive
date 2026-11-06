'use client';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import type {
  ApiCollection,
  ApiProject,
  ApiRequestDefinition,
} from '@clouddrive/surface/api-workbench';
import { Action } from '@clouddrive/ui-adapter/action';
import { MenuButton } from '@clouddrive/ui-adapter/menu-button';
import { DestructiveConfirmDialog, DrawerSurface } from '@clouddrive/ui-adapter/overlays';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { Tree, type TreeNode } from '@clouddrive/ui-adapter/tree';
import { Folder, Plus, Trash2 } from 'lucide-react';
export type ProjectTreeProps = Readonly<{
  projects: readonly ApiProject[];
  collections: readonly ApiCollection[];
  requests: readonly ApiRequestDefinition[];
  selectedRequestId: string | null;
  onSelectRequest: (id: string) => void;
  onCreateProject: (name: string) => Promise<void>;
  onCreateCollection: (projectId: string, name: string) => Promise<void>;
  onCreateRequest: (collectionId: string, name: string) => Promise<void>;
  onDelete: (kind: 'project' | 'collection' | 'request', id: string) => Promise<void>;
}>;
export function ProjectTree({
  projects,
  collections,
  requests,
  selectedRequestId,
  onSelectRequest,
  onCreateProject,
  onCreateCollection,
  onCreateRequest,
  onDelete,
}: ProjectTreeProps) {
  const { t } = useFrontendTranslation();
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<{ id: string; requestId: string | null } | null>(null);
  const activeId = selection?.requestId === selectedRequestId ? selection.id : null;
  const [createKind, setCreateKind] = useState<'project' | 'collection' | 'request' | null>(null);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    kind: 'project' | 'collection' | 'request';
    name: string;
  } | null>(null);
  const normalized = query.trim().toLowerCase();
  const matches = (value: string) => value.toLowerCase().includes(normalized);
  const nodes: readonly TreeNode[] = projects.flatMap((project) => {
    const children = collections
      .filter((col) => col.projectId === project.id)
      .flatMap((collection) => {
        const items = requests.filter(
          (request) =>
            request.collectionId === collection.id &&
            (!normalized ||
              matches(project.name) ||
              matches(collection.name) ||
              matches(request.name) ||
              matches(request.url)),
        );
        if (normalized && items.length === 0) return [];
        return [
          {
            id: collection.id,
            label: collection.name,
            leadingIcon: <Folder className="size-4" />,
            children: items.map((request) => ({
              id: request.id,
              label: `${request.method} ${request.name}`,
              description: request.url,
            })),
          },
        ];
      });
    return normalized && children.length === 0
      ? []
      : [
          {
            id: project.id,
            label: project.name,
            leadingIcon: <Folder className="size-4" />,
            children,
          },
        ];
  });
  const selectedId = activeId ?? selectedRequestId;
  const activeProject = projects.find((item) => item.id === selectedId);
  const activeCollection = collections.find((item) => item.id === selectedId);
  const activeRequest = requests.find((item) => item.id === selectedId);
  const active = activeProject ?? activeCollection ?? activeRequest;
  const beginCreate = (kind: 'project' | 'collection' | 'request') => {
    setName('');
    setFailed(false);
    setCreateKind(kind);
    if (kind === 'collection')
      setParentId(activeProject?.id ?? activeCollection?.projectId ?? projects[0]?.id ?? '');
    else if (kind === 'request')
      setParentId(activeCollection?.id ?? activeRequest?.collectionId ?? collections[0]?.id ?? '');
  };
  const createTitle = t(
    createKind === 'project'
      ? 'apiWorkbench.workspace.newProject'
      : createKind === 'collection'
        ? 'apiWorkbench.workspace.newCollection'
        : 'apiWorkbench.workspace.newRequest',
  );
  return (
    <aside
      aria-label={t('apiWorkbench.workspace.navigation')}
      className="grid min-w-0 content-start gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">
          {t('apiWorkbench.workspace.navigation')}
        </span>
        <MenuButton
          label={t('apiWorkbench.workspace.new')}
          ariaLabel={t('apiWorkbench.workspace.new')}
          items={[
            {
              id: 'project',
              label: t('apiWorkbench.workspace.newProject'),
              icon: <Plus className="size-4" />,
            },
            {
              id: 'collection',
              label: t('apiWorkbench.workspace.newCollection'),
              disabled: projects.length === 0,
            },
            {
              id: 'request',
              label: t('apiWorkbench.workspace.newRequest'),
              disabled: collections.length === 0,
            },
          ]}
          onAction={(id) => {
            if (id === 'project' || id === 'collection' || id === 'request') beginCreate(id);
          }}
        />
      </div>
      <SearchBox
        label={t('apiWorkbench.sidebar.searchPlaceholder')}
        placeholder={t('apiWorkbench.sidebar.searchPlaceholder')}
        value={query}
        onValueChange={setQuery}
      />
      <div className="max-h-80 min-w-0 overflow-y-auto">
        <Tree
          key={normalized ? `filter-${normalized}` : 'all'}
          label={t('apiWorkbench.workspace.navigation')}
          nodes={nodes}
          selectionMode="single"
          selectedIds={new Set(selectedId ? [selectedId] : [])}
          defaultExpandedIds={new Set([...projects, ...collections].map((item) => item.id))}
          expandLabel={t('apiWorkbench.common.expand')}
          collapseLabel={t('apiWorkbench.common.collapse')}
          onSelectionChange={(ids) => {
            const id = [...ids][0];
            if (!id) return;
            if (requests.some((item) => item.id === id)) {
              setSelection(null);
              onSelectRequest(id);
            } else setSelection({ id, requestId: selectedRequestId });
          }}
        />
        {nodes.length === 0 && (
          <div className="grid gap-3 py-6 text-sm leading-6 text-ink-muted">
            <p>
              {normalized
                ? t('apiWorkbench.workspace.searchEmpty', { query })
                : t('apiWorkbench.workspace.emptyProjects')}
            </p>
            {normalized && (
              <Action variant="quiet" size="sm" onPress={() => setQuery('')}>
                {t('apiWorkbench.common.clear')}
              </Action>
            )}
          </div>
        )}
      </div>
      {active && (
        <div className="grid gap-2 border-t border-border pt-3">
          <p className="break-words text-xs text-ink-muted">{active.name}</p>
          <div>
            <Action
              variant="quiet"
              size="sm"
              leadingIcon={<Trash2 className="size-4" />}
              onPress={() =>
                setDeleteTarget({
                  id: active.id,
                  name: active.name,
                  kind: activeProject ? 'project' : activeCollection ? 'collection' : 'request',
                })
              }
            >
              {t('apiWorkbench.common.delete')}
            </Action>
          </div>
        </div>
      )}
      <DrawerSurface
        triggerLabel={createTitle}
        title={createTitle}
        description={t('apiWorkbench.workspace.createDescription')}
        closeLabel={t('apiWorkbench.common.close')}
        isOpen={createKind !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setCreateKind(null);
        }}
      >
        <div className="grid gap-4">
          <TextField
            label={t('apiWorkbench.common.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {createKind !== 'project' && (
            <SelectField
              label={t(
                createKind === 'collection'
                  ? 'apiWorkbench.workspace.project'
                  : 'apiWorkbench.workspace.collection',
              )}
              value={parentId}
              options={(createKind === 'collection' ? projects : collections).map((item) => ({
                value: item.id,
                label:
                  'projectId' in item
                    ? `${projects.find((project) => project.id === item.projectId)?.name ?? ''} / ${item.name}`
                    : item.name,
              }))}
              onValueChange={setParentId}
            />
          )}
          {failed && (
            <p role="alert" className="text-sm text-danger">
              {t('apiWorkbench.feedback.saveFailed')}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Action variant="secondary" disabled={pending} onPress={() => setCreateKind(null)}>
              {t('apiWorkbench.common.cancel')}
            </Action>
            <Action
              loading={pending}
              disabled={!name.trim() || (createKind !== 'project' && !parentId)}
              onPress={() => {
                setPending(true);
                setFailed(false);
                const operation =
                  createKind === 'project'
                    ? onCreateProject(name.trim())
                    : createKind === 'collection'
                      ? onCreateCollection(parentId, name.trim())
                      : onCreateRequest(parentId, name.trim());
                void operation
                  .then(() => {
                    setCreateKind(null);
                    setSelection(null);
                  })
                  .catch(() => setFailed(true))
                  .finally(() => setPending(false));
              }}
            >
              {t('apiWorkbench.common.create')}
            </Action>
          </div>
        </div>
      </DrawerSurface>
      <DestructiveConfirmDialog
        triggerLabel={t('apiWorkbench.common.delete')}
        title={t('apiWorkbench.common.deleteTitle')}
        description={t('apiWorkbench.common.deleteDescription', { name: deleteTarget?.name })}
        impact={t(
          deleteTarget?.kind === 'request'
            ? 'apiWorkbench.common.deleteOneImpact'
            : 'apiWorkbench.common.deleteImpact',
        )}
        cancelLabel={t('apiWorkbench.common.cancel')}
        confirmLabel={t('apiWorkbench.common.delete')}
        failureMessage={t('apiWorkbench.feedback.saveFailed')}
        isOpen={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={async () => {
          if (deleteTarget) await onDelete(deleteTarget.kind, deleteTarget.id);
          setDeleteTarget(null);
          setSelection(null);
        }}
      />
    </aside>
  );
}

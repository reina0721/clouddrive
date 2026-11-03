import type {
  ApiRequestDefinition,
  KeyValueEntry,
  WorkspaceSnapshot,
} from '@clouddrive/surface/api-workbench';

export function createRequest(
  id: string,
  collectionId: string,
  name: string,
): ApiRequestDefinition {
  return {
    id,
    collectionId,
    name,
    method: 'GET',
    url: '{{baseUrl}}',
    params: [],
    headers: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    disguise: { timeoutMs: 10000 },
    extractors: [],
    preScript: '',
    postScript: '',
  };
}

export function removeWorkspaceEntity(
  snapshot: WorkspaceSnapshot,
  kind: 'project' | 'collection' | 'request',
  id: string,
): WorkspaceSnapshot {
  const projects =
    kind === 'project' ? snapshot.projects.filter((item) => item.id !== id) : snapshot.projects;
  const collections = snapshot.collections.filter(
    (item) =>
      !(kind === 'project' && item.projectId === id) && !(kind === 'collection' && item.id === id),
  );
  const validCollections = new Set(collections.map((item) => item.id));
  return {
    ...snapshot,
    projects,
    collections,
    requests: snapshot.requests.filter(
      (item) => validCollections.has(item.collectionId) && !(kind === 'request' && item.id === id),
    ),
    tasks: snapshot.tasks.filter((item) => validCollections.has(item.targetCollectionId)),
  };
}

/** Merge execution changes into the latest variables, preserving unrelated concurrent edits. */
export function mergeExecutionVariables(
  entries: readonly KeyValueEntry[],
  initial: Record<string, string>,
  next: Record<string, string>,
): readonly KeyValueEntry[] {
  const result = [...entries];
  for (const [key, value] of Object.entries(next)) {
    if (value === initial[key]) continue;
    const index = result.findIndex((item) => item.key === key);
    const old = result[index];
    const updated: KeyValueEntry = old
      ? { ...old, value, enabled: true }
      : {
          id: `var_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          key,
          value,
          enabled: true,
        };
    if (index >= 0) result[index] = updated;
    else result.push(updated);
  }
  return result;
}

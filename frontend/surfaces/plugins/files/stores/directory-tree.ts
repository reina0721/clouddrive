import { createAppStore } from '@clouddrive/state-foundation';
import { FilesError } from '../../../src/files/model';
import {
  directoryTreeRoot,
  directoryTreePageSize,
  emptyDirectoryBranch,
  initialDirectoryTree,
  maxAutomaticTreeBranches,
  maxDirectoryTreeFolders,
  type DirectoryTreeFailure,
  type DirectoryTreeSnapshot,
  type DirectoryTreeReader,
} from '../../../src/files/directory-tree';

class DirectoryTreeBudgetError extends Error {}
const failureCode = (error: unknown): DirectoryTreeFailure =>
  error instanceof DirectoryTreeBudgetError
    ? 'budget'
    : error instanceof FilesError
      ? error.code
      : 'unavailable';
const protocolParent = (key: string) => (key === directoryTreeRoot ? '' : key);
const branchKey = (parent: string) => parent || directoryTreeRoot;

/** createDirectoryTreeController 为一个工作区拥有分支缓存、串行请求与取消，不持有浏览器句柄。 */
export function createDirectoryTreeController(port: { list: DirectoryTreeReader }) {
  const store = createAppStore<DirectoryTreeSnapshot>(() => initialDirectoryTree());
  const requests = new Map<string, { controller: AbortController; result: Promise<boolean> }>();
  let tail = Promise.resolve();
  let active = false;
  let generation = 0;
  let followGeneration = 0;
  let revision: string | undefined;
  let location: string | undefined;
  let automatic = true;

  function updateBranch(parent: string, update: Partial<ReturnType<typeof emptyDirectoryBranch>>) {
    const current = store.getState();
    const branches = new Map(current.branches);
    branches.set(parent, { ...(branches.get(parent) ?? emptyDirectoryBranch()), ...update });
    store.setState({ branches });
  }
  function cancelRequests() {
    generation++;
    followGeneration++;
    for (const request of requests.values()) request.controller.abort();
    requests.clear();
    tail = Promise.resolve();
    const branches = new Map(store.getState().branches);
    for (const [key, branch] of branches) {
      if (branch.phase === 'loading')
        branches.set(key, { ...branch, phase: branch.page ? 'ready' : 'idle' });
    }
    store.setState({ branches, following: false });
  }
  function load(parent: string, page = 1): Promise<boolean> {
    if (!active) return Promise.resolve(false);
    const pending = requests.get(parent);
    if (pending && !pending.controller.signal.aborted) return pending.result;
    const known = store.getState().branches.get(parent);
    if (known?.phase === 'ready' && known.page >= page) return Promise.resolve(true);
    const controller = new AbortController();
    const startedGeneration = generation;
    const previous = tail;
    updateBranch(parent, { phase: 'loading', failure: '', failedPage: page });
    const current = () => active && !controller.signal.aborted && generation === startedGeneration;
    const result = (async () => {
      try {
        await previous;
        if (!current()) return false;
        const listing = await port.list(
          {
            parent: protocolParent(parent),
            category: '',
            search: '',
            trash: false,
            sort: 'name',
            desc: false,
            page,
            pageSize: directoryTreePageSize,
            filters: { kinds: ['folder'], scope: 'folder' },
          },
          controller.signal,
        );
        if (!current()) return false;
        if (
          listing.page !== page ||
          listing.pageSize !== directoryTreePageSize ||
          listing.items.some(
            (entry) => entry.kind !== 'folder' || entry.parentId !== protocolParent(parent),
          ) ||
          new Set(listing.items.map((entry) => entry.id)).size !== listing.items.length
        )
          throw new FilesError('invalid');
        let expectedParent = '';
        const visited = new Set<string>();
        for (const entry of listing.breadcrumbs) {
          if (entry.kind !== 'folder' || entry.parentId !== expectedParent || visited.has(entry.id))
            throw new FilesError('conflict');
          visited.add(entry.id);
          expectedParent = entry.id;
        }
        if (expectedParent !== protocolParent(parent)) throw new FilesError('conflict');
        if (page > 1 && known && listing.total !== known.total) throw new FilesError('conflict');
        const snapshot = store.getState();
        const folders = new Map(snapshot.folders);
        for (const entry of [...listing.breadcrumbs, ...listing.items])
          folders.set(entry.id, entry);
        if (folders.size > maxDirectoryTreeFolders) throw new DirectoryTreeBudgetError();
        const pathChildren = new Map(snapshot.pathChildren);
        for (const entry of listing.breadcrumbs) {
          const key = branchKey(entry.parentId);
          pathChildren.set(key, [...new Set([...(pathChildren.get(key) ?? []), entry.id])]);
        }
        const branches = new Map(snapshot.branches);
        const preceding = page === 1 ? [] : (branches.get(parent)?.items ?? []);
        const items = [...new Set([...preceding, ...listing.items.map((entry) => entry.id)])];
        if (page * directoryTreePageSize >= listing.total && items.length !== listing.total)
          throw new FilesError('conflict');
        if (items.length === listing.total) pathChildren.delete(parent);
        branches.set(parent, {
          items,
          page,
          total: listing.total,
          phase: 'ready',
          failure: '',
          failedPage: page,
        });
        store.setState({ branches, folders, pathChildren });
        return true;
      } catch (error) {
        if (current())
          updateBranch(parent, { phase: 'failed', failure: failureCode(error), failedPage: page });
        return false;
      } finally {
        if (requests.get(parent)?.controller === controller) requests.delete(parent);
      }
    })();
    requests.set(parent, { controller, result });
    tail = result.then(() => undefined);
    return result;
  }
  async function follow(parent: string) {
    if (!active) return;
    const token = ++followGeneration;
    const valid = () => active && token === followGeneration;
    const key = branchKey(parent);
    store.setState({ rootOpen: true, following: true, pathFailure: '' });
    if (!(await load(key))) {
      if (valid())
        store.setState({
          following: false,
          pathFailure: store.getState().branches.get(key)?.failure ?? 'unavailable',
        });
      return;
    }
    if (!valid()) return;
    const path: string[] = [];
    let cursor = parent;
    const snapshot = store.getState();
    while (cursor) {
      const folder = snapshot.folders.get(cursor);
      if (!folder || path.includes(cursor) || path.length >= maxDirectoryTreeFolders) {
        store.setState({ following: false, pathFailure: 'conflict' });
        return;
      }
      path.unshift(cursor);
      cursor = folder.parentId;
    }
    store.setState({ expanded: new Set([...snapshot.expanded, ...path]) });
    // 已验证路径先呈现；只自动补全有界层数，其余分支保留显式载入入口。
    for (const ancestor of [directoryTreeRoot, ...path].slice(0, maxAutomaticTreeBranches)) {
      if (!valid()) return;
      if (!(await load(ancestor))) break;
    }
    if (valid()) store.setState({ following: false });
  }
  async function refresh() {
    if (!active) return;
    const previous = store.getState();
    cancelRequests();
    store.setState({
      ...initialDirectoryTree(),
      ready: true,
      rootOpen: previous.rootOpen,
      expanded: previous.expanded,
    });
    const refreshedGeneration = generation;
    if (!previous.rootOpen) return;
    if (automatic && location !== undefined) await follow(location);
    else await load(directoryTreeRoot);
    for (const key of [...previous.expanded].slice(0, maxAutomaticTreeBranches)) {
      if (!active || generation !== refreshedGeneration || !store.getState().rootOpen) return;
      await load(key);
      if (store.getState().branches.get(key)?.failure === 'budget') break;
    }
  }
  return {
    store,
    start() {
      active = true;
      store.setState({ ready: true });
      revision = undefined;
      location = undefined;
    },
    stop() {
      active = false;
      cancelRequests();
      store.setState({ ready: false });
    },
    synchronize(next: { revision: string; parent: string | undefined; automatic: boolean }) {
      const changed = location !== next.parent || automatic !== next.automatic;
      const invalidated = revision !== undefined && revision !== next.revision;
      location = next.parent;
      automatic = next.automatic;
      revision = next.revision;
      if (invalidated) {
        void refresh();
        return;
      }
      if (changed) {
        followGeneration++;
        store.setState({ following: false, pathFailure: '' });
        if (automatic && location) void follow(location);
      }
    },
    toggleRoot: () => {
      if (store.getState().rootOpen) {
        cancelRequests();
        store.setState({ rootOpen: false });
      } else {
        store.setState({ rootOpen: true });
        if (automatic && location) void follow(location);
        else void load(directoryTreeRoot);
      }
    },
    expand: (ids: ReadonlySet<string>) => {
      followGeneration++;
      store.setState({ following: false });
      const previous = store.getState().expanded;
      const expanded = new Set([...ids].filter((id) => store.getState().folders.has(id)));
      store.setState({ expanded });
      for (const id of expanded) if (!previous.has(id)) void load(id);
      for (const id of previous)
        if (!expanded.has(id)) {
          for (const [key, pending] of requests) {
            let cursor = key;
            const seen = new Set<string>();
            while (cursor && !seen.has(cursor)) {
              if (cursor === id) {
                pending.controller.abort();
                const branch = store.getState().branches.get(key) ?? emptyDirectoryBranch();
                updateBranch(key, { phase: branch.page ? 'ready' : 'idle' });
                break;
              }
              seen.add(cursor);
              cursor = store.getState().folders.get(cursor)?.parentId ?? '';
            }
          }
        }
    },
    loadNext(parent: string, expectedPage: number) {
      const branch = store.getState().branches.get(parent) ?? emptyDirectoryBranch();
      const page = branch.phase === 'failed' ? branch.failedPage : branch.page + 1;
      if (page !== expectedPage) return Promise.resolve(false);
      return load(parent, page);
    },
    refresh,
    retryPath: () => {
      if (location !== undefined) void follow(location);
    },
  };
}

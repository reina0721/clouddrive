import {
  createLocalStorage,
  createPersistStore,
  createHydrationLifecycle,
} from '@clouddrive/state-foundation';
import { useWorkspaceStore } from '../state/use-workspace-store';
import { useWorkbenchStore } from '../state/use-workbench-store';
import { useNotificationsStore } from '../state/use-notifications-store';
import { usePageTabsStore } from '../state/use-page-tabs-store';
import { AuthError } from './contract';

const owner = createPersistStore<{ userId: string | null }, { userId: string | null }>(
  () => ({ userId: null }),
  {
    name: 'clouddrive.auth-owner',
    version: 1,
    skipHydration: true,
    storage: createLocalStorage(),
    partialize: ({ userId }) => ({ userId }),
  },
);
const deviceKeys = new Set(['clouddrive.shell', 'clouddrive.auth-mock', 'clouddrive.auth-owner']);

/** Called before the authorized subtree mounts. Identity-changing navigation reloads Plugin modules. */
export function applyAccountBoundary(userId: string | null): void {
  const lifecycle = createHydrationLifecycle(owner);
  lifecycle.trigger();
  if (lifecycle.status !== 'hydrated') throw new AuthError('unavailable');
  if (owner.getState().userId === userId && userId !== null) return;
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
      for (const key of keys)
        if (key?.startsWith('clouddrive.') && !deviceKeys.has(key)) storage.removeItem(key);
    }
    useWorkspaceStore.setState({ records: {} });
    useWorkbenchStore.setState({ recents: [], favorites: [] });
    useNotificationsStore.setState({ items: [] });
    usePageTabsStore.setState({ tabs: [] });
    owner.setState({ userId });
  } catch {
    throw new AuthError('unavailable');
  }
}

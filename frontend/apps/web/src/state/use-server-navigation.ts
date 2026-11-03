import { createAppStore } from '@clouddrive/state-foundation';
import type { NavigationOverrides } from './use-navigation-admin-store';

export const useServerNavigationStore = createAppStore<{
  overrides: NavigationOverrides;
  ready: boolean;
  failed: boolean;
}>(() => ({ overrides: {}, ready: false, failed: false }));
export async function refreshServerNavigation(base: string): Promise<void> {
  try {
    const { loadNavigation } = await import('./navigation-response');
    const result = await loadNavigation(base);
    const overrides: Record<string, NavigationOverrides[string]> = {};
    for (const menu of result.items) {
      overrides[menu.id] = {
        version: menu.version,
        hidden: !menu.enabled,
        order: menu.order,
        parentId: menu.parentId,
        ...(menu.label ? { label: menu.label } : {}),
        ...(menu.permission ? { permission: menu.permission } : {}),
      };
    }
    useServerNavigationStore.setState({ overrides, ready: true, failed: false });
  } catch (error) {
    useServerNavigationStore.setState({ ready: false, failed: true });
    throw error;
  }
}

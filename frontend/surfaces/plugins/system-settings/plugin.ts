import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';
export const pluginDefinition = {
  pluginId: 'system-settings',
  mount: '/system-settings',
} as const satisfies PluginDefinition;

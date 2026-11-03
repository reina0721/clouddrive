import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';
export const pluginDefinition = {
  pluginId: 'roles',
  mount: '/roles',
} as const satisfies PluginDefinition;

import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';
export const pluginDefinition = {
  pluginId: 'users',
  mount: '/users',
} as const satisfies PluginDefinition;

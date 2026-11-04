import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';
export const pluginDefinition = {
  pluginId: 'files',
  mount: '/home',
} as const satisfies PluginDefinition;

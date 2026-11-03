import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';

export const pluginDefinition = {
  pluginId: 'foundations',
  mount: '/foundations',
} as const satisfies PluginDefinition;

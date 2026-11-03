import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';

export const pluginDefinition = {
  pluginId: 'dictionaries',
  mount: '/system/dictionaries',
} as const satisfies PluginDefinition;

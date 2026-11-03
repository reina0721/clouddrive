import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';

export const pluginDefinition = {
  pluginId: 'reference-resources',
  mount: '/reference-resources',
} as const satisfies PluginDefinition;

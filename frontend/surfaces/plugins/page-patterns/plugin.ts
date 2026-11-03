import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';

export const pluginDefinition = {
  pluginId: 'page-patterns',
  mount: '/page-patterns',
} as const satisfies PluginDefinition;

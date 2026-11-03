import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';

export const pluginDefinition = {
  pluginId: 'page-archetypes',
  mount: '/page-archetypes',
} as const satisfies PluginDefinition;

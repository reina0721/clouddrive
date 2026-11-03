import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';

export const pluginDefinition = {
  pluginId: 'states',
  mount: '/states',
} as const satisfies PluginDefinition;

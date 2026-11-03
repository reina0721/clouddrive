import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';

export const pluginDefinition = {
  pluginId: 'analytics',
  mount: '/analytics',
} as const satisfies PluginDefinition;

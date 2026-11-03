import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';
export const pluginDefinition = {
  pluginId: 'notifications',
  mount: '/notifications',
} as const satisfies PluginDefinition;

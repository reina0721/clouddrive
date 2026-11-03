import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';

export const pluginDefinition = {
  pluginId: 'menus',
  mount: '/system/menus',
} as const satisfies PluginDefinition;

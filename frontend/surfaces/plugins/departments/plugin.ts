import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';

export const pluginDefinition = {
  pluginId: 'departments',
  mount: '/system/departments',
} as const satisfies PluginDefinition;

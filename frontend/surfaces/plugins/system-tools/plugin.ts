import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';

export const pluginDefinition = {
  pluginId: 'system-tools',
  mount: '/system-tools',
} as const satisfies PluginDefinition;

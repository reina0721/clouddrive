import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';

export const pluginDefinition = {
  pluginId: 'motion',
  mount: '/motion',
} as const satisfies PluginDefinition;

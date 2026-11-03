import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';
export const pluginDefinition = {
  pluginId: 'account',
  mount: '/account',
} as const satisfies PluginDefinition;

import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';

export const pluginDefinition = {
  pluginId: 'ui-elements',
  mount: '/ui-elements',
} as const satisfies PluginDefinition;

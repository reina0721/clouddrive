import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';

export const pluginDefinition = {
  pluginId: 'workspace',
  mount: '/workspace',
} as const satisfies PluginDefinition;

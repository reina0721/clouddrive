import type { PluginDefinition } from '@clouddrive/plugin-framework/plugin';

/**
 * settings —— 独立设置中心插件。
 *
 * 拥有设置分类、文案、搜索目录与页面组合；只在 group `system` 贡献一个"设置"入口。
 * 偏好读写经 `@clouddrive/plugin-framework/preferences` 的 Preferences Port
 * （Host composition root 注入），不直接 import Host store。
 */
export const pluginDefinition = {
  pluginId: 'settings',
  mount: '/settings',
} as const satisfies PluginDefinition;

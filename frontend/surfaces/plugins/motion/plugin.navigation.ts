import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';

/**
 * motion —— Sidebar Navigation Contribution。
 *
 * Group `development`（plugins 公共 Group Alias）下带 routeId 的 Parent，
 * routeId 指向根 Route（/motion）。Motion 展示页与 MotionInspector（dev 工具）
 * 随本 Plugin colocated；MotionPolicy Provider 仍由 Host 装配（Runtime ownership）。
 */
export const navigationContribution = {
  parents: [
    {
      navigationId: 'motion.root',
      labelKey: 'motionNav.root',
      groupId: 'development',
      order: 60,
      iconId: 'motion',
      routeId: 'motion',
    },
  ],
} as const satisfies NavigationContribution;

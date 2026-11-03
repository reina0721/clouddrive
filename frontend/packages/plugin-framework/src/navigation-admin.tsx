/**
 * Plugin Framework —— Navigation Administration Capability（client）。
 *
 * `@clouddrive/plugin-framework/navigation-admin`：菜单管理（业务呈现覆盖）的公共
 * 契约 + Provider/hook。Host 注入实现（Host 拥有的持久化 store），Plugin 只能读
 * 部署期路由目录 + 写呈现覆盖，不能自建路由或导航真相。
 *
 * 边界：
 * - 部署期 Plugin Registry 仍是路由/组件的唯一真相（构建期生成，运行期只读）；
 * - 本 Port 只承载**运行期业务覆盖**：可见性、标题、排序、所需权限码；
 * - 覆盖只影响 Shell 导航呈现，不改变路由存在性、不构成授权（后端/数据服务仍是
 *   授权边界）；Host 在应用覆盖后仍按权限过滤。
 */

'use client';

/* Library entry 同时导出 Provider、Hook，不是应用 Fast Refresh 边界。 */
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, type ReactNode } from 'react';

/** 单个导航节点的业务覆盖；`version` 用于乐观并发（每次写入自增）。 */
export type NavigationAdminOverride = Readonly<{
  hidden?: boolean;
  label?: string;
  order?: number;
  permission?: string | null;
  version: number;
}>;

export type NavigationAdminOverrides = Readonly<Record<string, NavigationAdminOverride>>;

export type NavigationAdminPatch = Readonly<{
  hidden?: boolean;
  label?: string;
  order?: number;
  permission?: string | null;
}>;

export type NavigationAdminFailureCode = 'conflict' | 'invalid';

export type NavigationAdminResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; code: NavigationAdminFailureCode; reason: string }>;

/** Port 快照（Host store 直接暴露；引用稳定，供 selector 订阅）。 */
export type NavigationAdminSnapshot = Readonly<{
  overrides: NavigationAdminOverrides;
  updatedAt: number | null;
  hydrated: boolean;
}>;

export type NavigationAdminPort = Readonly<{
  getSnapshot: () => NavigationAdminSnapshot;
  subscribe: (listener: () => void) => () => void;
  update: (
    navigationId: string,
    patch: NavigationAdminPatch,
    expectedVersion: number,
  ) => NavigationAdminResult;
  resetPresentation: (navigationId: string, expectedVersion: number) => NavigationAdminResult;
  clear: (navigationId: string, expectedVersion: number) => NavigationAdminResult;
  clearAll: () => NavigationAdminResult;
  /** 损坏记录恢复：清除本地记录并重新水合（显式用户动作）。 */
  recover: () => void;
}>;

const NavigationAdminContext = createContext<NavigationAdminPort | null>(null);

/** Host 装配 Navigation Administration Port；必须在 Root Provider 中只安装一次。 */
export function NavigationAdminProvider({
  port,
  children,
}: Readonly<{ port: NavigationAdminPort; children: ReactNode }>) {
  return <NavigationAdminContext.Provider value={port}>{children}</NavigationAdminContext.Provider>;
}

/** 读取 Navigation Administration Port。 */
export function useNavigationAdminPort(): NavigationAdminPort {
  const port = useContext(NavigationAdminContext);
  if (!port) {
    throw new Error(
      'NavigationAdminProvider 未安装：Navigation Administration Port 属于 application runtime context。',
    );
  }
  return port;
}

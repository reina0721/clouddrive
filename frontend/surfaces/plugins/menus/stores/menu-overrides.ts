'use client';

import {
  useNavigationAdminPort,
  type NavigationAdminPatch,
  type NavigationAdminResult,
} from '@clouddrive/plugin-framework/navigation-admin';
import { useMemo, useSyncExternalStore } from 'react';

import type { MenuOverride, MenuOverrides } from '../src/menu-overlay';

/**
 * menus 插件对 Host 导航覆盖的消费适配（Port 形态，不持有第二份持久化）。
 *
 * 归属边界：持久化真相在 Host（`clouddrive.navigation-admin`，由 Host 在
 * 导航构建时应用）；插件只通过 `NavigationAdminPort` 读写，并保留原有的
 * `useMenuOverlayStore(selector)` 选择器形态，使页面与对话框逻辑保持一份。
 *
 * `writable` 是页面从唯一授权源 `useProductAccess()` 得出的防御性写入闸门
 * 镜像，不是第二授权源；权限判定仍由 Host/数据服务负责。
 */

export type MenuOverlayFailureCode = 'conflict' | 'readonly' | 'invalid';

export type MenuOverlayResult =
  Readonly<{ ok: true }> | Readonly<{ ok: false; code: MenuOverlayFailureCode; reason: string }>;

export type MenuOverridesState = Readonly<{
  overrides: MenuOverrides;
  updatedAt: number | null;
  writable: boolean;
  setWritable: (writable: boolean) => void;
  update: (routeId: string, patch: MenuOverridePatch, expectedVersion: number) => MenuOverlayResult;
  resetPresentation: (routeId: string, expectedVersion: number) => MenuOverlayResult;
  clear: (routeId: string, expectedVersion: number) => MenuOverlayResult;
  clearAll: () => MenuOverlayResult;
}>;

type MenuOverridePatch = Readonly<{
  hidden?: boolean;
  label?: string;
  order?: number | null;
  permission?: string | null;
}>;

let writableFlag = false;
const writableListeners = new Set<() => void>();

function setWritableFlag(writable: boolean) {
  if (writableFlag === writable) return;
  writableFlag = writable;
  for (const listener of writableListeners) listener();
}

function subscribeWritable(listener: () => void) {
  writableListeners.add(listener);
  return () => {
    writableListeners.delete(listener);
  };
}

const readWritable = () => writableFlag;
const serverWritable = () => false;

const readonlyFailure = (): MenuOverlayResult => ({
  ok: false,
  code: 'readonly',
  reason: 'permission',
});

function toResult(result: NavigationAdminResult): MenuOverlayResult {
  return result.ok ? { ok: true } : { ok: false, code: result.code, reason: result.reason };
}

function toPortPatch(patch: MenuOverridePatch): NavigationAdminPatch {
  return {
    ...(patch.hidden !== undefined ? { hidden: patch.hidden } : {}),
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.order !== undefined && patch.order !== null ? { order: patch.order } : {}),
    ...(patch.permission !== undefined ? { permission: patch.permission } : {}),
  };
}

export function useMenuOverlayStore<T>(selector: (state: MenuOverridesState) => T): T {
  const port = useNavigationAdminPort();
  const snapshot = useSyncExternalStore(port.subscribe, port.getSnapshot, port.getSnapshot);
  const writable = useSyncExternalStore(subscribeWritable, readWritable, serverWritable);
  const actions = useMemo(() => {
    const guarded = <T>(run: () => T): T | MenuOverlayResult =>
      writableFlag ? run() : readonlyFailure();
    return {
      setWritable: setWritableFlag,
      update: (routeId: string, patch: MenuOverridePatch, expectedVersion: number) =>
        guarded(() => toResult(port.update(routeId, toPortPatch(patch), expectedVersion))),
      resetPresentation: (routeId: string, expectedVersion: number) =>
        guarded(() => toResult(port.resetPresentation(routeId, expectedVersion))),
      clear: (routeId: string, expectedVersion: number) =>
        guarded(() => toResult(port.clear(routeId, expectedVersion))),
      clearAll: () => guarded(() => toResult(port.clearAll())),
    };
  }, [port]);

  const overrides = snapshot.overrides as MenuOverrides;
  const state = useMemo<MenuOverridesState>(
    () => ({
      overrides,
      updatedAt: snapshot.updatedAt,
      writable,
      ...actions,
    }),
    [overrides, snapshot.updatedAt, writable, actions],
  );
  return selector(state);
}

/** 读取单条覆盖（供对话框在保存冲突后重新加载最新值）。 */
export function useMenuOverride(routeId: string): MenuOverride | undefined {
  const port = useNavigationAdminPort();
  const snapshot = useSyncExternalStore(port.subscribe, port.getSnapshot, port.getSnapshot);
  return (snapshot.overrides as MenuOverrides)[routeId];
}

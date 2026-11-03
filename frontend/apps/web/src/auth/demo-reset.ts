import { forgetDemoAccount } from './demo-session';

/** 账号作用域内、重置演示数据时保留的设备级 key（界面偏好）。 */
const preservedKeys = new Set(['clouddrive.shell', 'clouddrive.auth-demo']);

/**
 * 重置演示数据（显式 Mock 部署专用）。
 *
 * 语义边界：
 * - 清除 Mock 身份目录、会话与账号作用域内的业务数据，使下一次进入重新播种；
 * - 保留 `clouddrive.shell`（界面偏好）与演示身份记忆，避免把"重置演示数据"
 *   变成"清空个人偏好"；
 * - 不触碰真实后端数据（本函数仅用于 Mock 模式，调用方负责模式判定）；
 * - 调用后整页重载到 /login，确保所有内存态与 Plugin 模块重新装配。
 */
export function resetDemoData(): void {
  if (typeof window === 'undefined') return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    for (const key of keys) {
      if (key?.startsWith('clouddrive.') && !preservedKeys.has(key)) storage.removeItem(key);
    }
  }
  forgetDemoAccount();
  window.location.replace('/login');
}

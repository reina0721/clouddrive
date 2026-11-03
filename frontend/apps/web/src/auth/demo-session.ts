/**
 * 演示身份记忆（Host、非敏感）。
 *
 * 只记住"上次用哪个演示身份进入"，不保存密码、不保存会话；用于登录页的
 * "上次使用"提示。演示部署之外（后端模式）不会写入。
 *
 * 存储：localStorage `clouddrive.auth-demo` version 1 —— 与身份/偏好 key 分离，
 * 账户切换时由 account-boundary 之外的显式重置清理（演示记忆不影响权限）。
 */
import { demoAccounts } from './demo-accounts';

const DEMO_MEMORY_KEY = 'clouddrive.auth-demo';
const DEMO_MEMORY_VERSION = 1;

type DemoMemory = Readonly<{ version: number; lastAccountId: string | null }>;

function readMemory(): DemoMemory {
  if (typeof window === 'undefined') return { version: DEMO_MEMORY_VERSION, lastAccountId: null };
  try {
    const raw = window.localStorage.getItem(DEMO_MEMORY_KEY);
    if (!raw) return { version: DEMO_MEMORY_VERSION, lastAccountId: null };
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object')
      return { version: DEMO_MEMORY_VERSION, lastAccountId: null };
    const record = parsed as Record<string, unknown>;
    const id = record.lastAccountId;
    const known =
      typeof id === 'string' && demoAccounts.some((account) => account.id === id) ? id : null;
    return { version: DEMO_MEMORY_VERSION, lastAccountId: known };
  } catch {
    return { version: DEMO_MEMORY_VERSION, lastAccountId: null };
  }
}

/** 上次使用的演示身份 id（非法/未知记录视为无记忆）。 */
export function readLastDemoAccountId(): string | null {
  return readMemory().lastAccountId;
}

/** 记住本次演示身份；写入失败（隐私模式/配额）不影响登录。 */
export function rememberDemoAccount(id: string): void {
  if (typeof window === 'undefined') return;
  if (!demoAccounts.some((account) => account.id === id)) return;
  try {
    window.localStorage.setItem(
      DEMO_MEMORY_KEY,
      JSON.stringify({ version: DEMO_MEMORY_VERSION, lastAccountId: id }),
    );
  } catch {
    /* 记忆是可选的便利能力：写入失败不阻断登录。 */
  }
}

/** 清除演示记忆（重置演示数据时调用）。 */
export function forgetDemoAccount(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DEMO_MEMORY_KEY);
  } catch {
    /* ignore */
  }
}

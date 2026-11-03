import { readMockDatabase } from '../identity/mock-database';
import { readAuthConfig } from './config';
import { MOCK_DEMO_PASSWORD, passwordDigest } from './mock-adapter';

/**
 * 锁屏解锁的密码复核（Host，非会话登录）。
 *
 * 为什么不是 `auth.login`：登录失败会按认证语义清空当前会话，用它做"解锁"
 * 会让一次输错密码直接退出登录，属于产品缺陷。锁屏只做**只读凭据复核**：
 * - Mock 部署：对目录账号校验 PBKDF2 摘要；fixture 账号校验 fixture 常量；
 * - Backend 部署：没有安全的"仅校验密码"端点，返回 `unsupported`，界面只提供
 *   重新登录（不把登录当解锁）。
 *
 * 边界：复核通过只解除本地遮挡，不延长会话、不改变授权。
 */
export type UnlockResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; code: 'credentials' | 'unsupported' | 'unavailable' }>;

export async function verifyAccountPassword(
  email: string,
  password: string,
): Promise<UnlockResult> {
  try {
    if (readAuthConfig().mode !== 'mock') return { ok: false, code: 'unsupported' };
    const normalized = email.trim().toLowerCase();
    const database = await readMockDatabase();
    const user = database.users.find((candidate) => candidate.email === normalized);
    if (!user || user.status !== 'active') return { ok: false, code: 'credentials' };
    const account = database.accounts.find((candidate) => candidate.user.id === user.id);
    if (account) {
      const digest = await passwordDigest(password, account.salt);
      return digest === account.digest ? { ok: true } : { ok: false, code: 'credentials' };
    }
    // fixture 账号（无凭据记录）使用统一演示密码，与 mock-auth 的登录校验一致。
    return password === MOCK_DEMO_PASSWORD ? { ok: true } : { ok: false, code: 'credentials' };
  } catch {
    return { ok: false, code: 'unavailable' };
  }
}

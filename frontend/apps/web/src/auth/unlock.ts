import { readMockDatabase } from '../identity/mock-database';
import { ApiError, createJsonClient } from '../api/json-client';
import { readAuthConfig } from './config';
import { MOCK_DEMO_PASSWORD, passwordDigest } from './mock-adapter';

/**
 * 锁屏解锁的密码复核（Host，非会话登录）。
 *
 * 为什么不是 `auth.login`：登录失败会按认证语义清空当前会话，用它做"解锁"
 * 会让一次输错密码直接退出登录，属于产品缺陷。锁屏只复核当前身份，不建立新会话：
 * - Mock 部署：对目录账号校验 PBKDF2 摘要；fixture 账号校验 fixture 常量；
 * - Backend 部署：当前 Cookie 会话确定账号；不发送账号标识，不调用登录接口。
 *
 * 边界：复核只解除本地遮挡，不创建会话、不延长绝对期限或改变授权。
 */
export type UnlockResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      code: 'credentials' | 'locked' | 'expired' | 'forbidden' | 'unavailable';
    }>;

export async function verifyAccountPassword(
  email: string,
  password: string,
  signal?: AbortSignal,
): Promise<UnlockResult> {
  try {
    const config = readAuthConfig();
    if (config.mode === 'backend') {
      const result = await createJsonClient(config.apiBaseUrl)('/auth/password/verify', {
        method: 'POST',
        body: { password },
        ...(signal ? { signal } : {}),
      });
      if (
        typeof result !== 'object' ||
        result === null ||
        !('verified' in result) ||
        result.verified !== true
      )
        return { ok: false, code: 'unavailable' };
      return { ok: true };
    }
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
  } catch (error) {
    if (error instanceof ApiError && error.code === 'http') {
      if (error.status === 429) return { ok: false, code: 'locked' };
      if (error.status === 403) return { ok: false, code: 'forbidden' };
      if (error.status === 401) {
        const payload = error.payload;
        const credentials =
          typeof payload === 'object' &&
          payload !== null &&
          'error' in payload &&
          typeof payload.error === 'object' &&
          payload.error !== null &&
          'code' in payload.error &&
          payload.error.code === 'credentials';
        return { ok: false, code: credentials ? 'credentials' : 'expired' };
      }
    }
    return { ok: false, code: 'unavailable' };
  }
}

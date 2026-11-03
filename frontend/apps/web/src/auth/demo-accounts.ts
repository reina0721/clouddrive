import { MOCK_DEMO_PASSWORD } from './mock-adapter';

/**
 * 显式 Mock 演示身份（Host 认证边界，单一事实源）。
 *
 * - 只描述"演示部署里真实可登录的三个身份"：邮箱来自目录种子
 *   （apps/web/src/identity/mock-database.ts initialMockUsers），密码来自
 *   mock-adapter 的 fixture 常量，二者必须同时成立，否则快捷登录会失败而不是伪造成功。
 * - 角色 ID 与角色权限仍由 identity 种子提供（administrator / operator / viewer），
 *   本文件不复制权限定义，避免第二套授权真相。
 * - 仅 Host 消费：Plugin、Surface Foundation 不得引用演示凭据。
 */
export type DemoRoleId = 'administrator' | 'operator' | 'viewer';

export type DemoAccount = Readonly<{
  /** 目录用户 id（与 identity 种子一致，用于去重与"上次使用"记忆）。 */
  id: string;
  /** 角色 id（identity 角色真相，仅用于 i18n 文案映射）。 */
  roleId: DemoRoleId;
  name: string;
  email: string;
}>;

/** 三个演示身份；顺序即呈现顺序（权限由高到低）。 */
export const demoAccounts: readonly DemoAccount[] = [
  { id: 'mock-demo', roleId: 'administrator', name: 'Rin', email: 'demo@community.test' },
  {
    id: 'mock-operator',
    roleId: 'operator',
    name: 'Alex Chen',
    email: 'operator@community.test',
  },
  { id: 'mock-viewer', roleId: 'viewer', name: 'Morgan Lee', email: 'viewer@community.test' },
];

/** 演示 fixture 密码：与 mock-adapter / identity fixture 校验共用同一常量。 */
export const demoAccountPassword = MOCK_DEMO_PASSWORD;

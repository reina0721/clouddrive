/**
 * E2E 基地址：优先使用显式环境变量，其次复用 `playwright.config.ts` 已加载的 WEB_HOST/WEB_PORT。
 * 测试不得再硬编码端口——历史上多个 spec 写死 4173，配置迁移后导致整片用例失败。
 */
function resolveHost(): string {
  const host = process.env.WEB_HOST ?? '127.0.0.1';
  return host === '0.0.0.0' ? '127.0.0.1' : host;
}

export const e2eBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://${resolveHost()}:${process.env.WEB_PORT ?? '4173'}`;

/** backend-contract project 的独立端口（playwright.config 使用 primary + 1）。 */
export const e2eBackendBaseUrl = `http://${resolveHost()}:${Number(process.env.WEB_PORT ?? '4173') + 1}`;

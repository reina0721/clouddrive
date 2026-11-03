import type { RequestHandler } from 'msw';
import { setupServer } from 'msw/node';

// createMockServer 只服务测试与显式预览；生产 Host 不会静默切换到 Mock 数据源。
export function createMockServer(...handlers: RequestHandler[]) {
  return setupServer(...handlers);
}

import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import { resolve } from 'node:path';

import { loadWebConfig } from '@clouddrive/config/node';

const config = loadWebConfig({ cwd: import.meta.dirname });
const deploymentMode = config.deploymentMode;

export default function nextConfig(phase: string): NextConfig {
  return {
    // 视觉验收只比较产品界面；普通开发仍保留 Next 开发指示器。
    ...(process.env.CLOUDDRIVE_BROWSER_TEST === '1' ? { devIndicators: false as const } : {}),
    // 允许通过 127.0.0.1、localhost 访问 0.0.0.0 监听的开发服务器
    allowedDevOrigins: ['127.0.0.1', 'localhost'],
    experimental: {
      proxyClientMaxBodySize: '32mb',
      // 多个隔离生产目录不保留编译数据库；避免缓存压缩额外占用构建磁盘。
      turbopackFileSystemCacheForBuild: false,
    },
    // 浏览器验收使用独立构建目录，避免与普通开发或生产构建相互覆盖。
    distDir: config.distDir ?? (phase === PHASE_DEVELOPMENT_SERVER ? '.next' : 'dist'),
    // Trace workspace dependencies into a relocatable runtime, not the whole repo.
    outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
    output: deploymentMode === 'server' ? 'standalone' : 'export',
    headers() {
      return Promise.resolve([
        {
          source: '/home/:path*',
          headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
        },
        {
          source: '/file-viewers/pdf/:path*',
          headers: [
            {
              key: 'Content-Security-Policy',
              value:
                "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
            },
            { key: 'Referrer-Policy', value: 'no-referrer' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          ],
        },
      ]);
    },
    transpilePackages: [
      '@clouddrive/config',
      '@clouddrive/core',
      '@clouddrive/design-system',
      '@clouddrive/surface-foundation',
      '@clouddrive/plugin-framework',
      '@clouddrive/surface',
      '@clouddrive/form-foundation',
      '@clouddrive/i18n',
      '@clouddrive/types',
      '@clouddrive/ui-adapter',
    ],
  };
}

import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

import { loadWebConfig } from '@clouddrive/config/node';

const config = loadWebConfig({ cwd: import.meta.dirname });
const deploymentMode = config.deploymentMode;

export default function nextConfig(phase: string): NextConfig {
  return {
    // 允许通过 127.0.0.1、localhost 访问 0.0.0.0 监听的开发服务器
    allowedDevOrigins: ['127.0.0.1', 'localhost'],
    experimental: {
      proxyClientMaxBodySize: '32mb',
      // 多个隔离生产目录不保留编译数据库；避免缓存压缩额外占用构建磁盘。
      turbopackFileSystemCacheForBuild: false,
    },
    // Playwright 的 dev server 使用独立目录，避免 production build 覆盖正在运行的开发缓存。
    distDir: config.distDir ?? (phase === PHASE_DEVELOPMENT_SERVER ? '.next' : 'dist'),
    // server Mode 不设 output（真实 Next Runtime Server）；static / static-enumerated 用静态导出。
    ...(deploymentMode === 'server' ? {} : { output: 'export' as const }),
    ...(deploymentMode === 'server'
      ? {
          rewrites() {
            const backend = process.env.CLOUDDRIVE_BACKEND_URL ?? 'http://127.0.0.1:8080';
            return Promise.resolve([
              { source: '/api/:path*', destination: backend + '/api/:path*' },
              { source: '/wopi/:path*', destination: backend + '/wopi/:path*' },
              { source: '/management/:path*', destination: backend + '/management/:path*' },
            ]);
          },
        }
      : {}),
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

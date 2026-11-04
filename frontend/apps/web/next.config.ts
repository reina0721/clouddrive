import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

import { loadWebConfig } from '@clouddrive/config/node';

const config = loadWebConfig({ cwd: import.meta.dirname });
const deploymentMode = config.deploymentMode;

export default function nextConfig(phase: string): NextConfig {
  return {
    // 允许通过 127.0.0.1、localhost 访问 0.0.0.0 监听的开发服务器
    allowedDevOrigins: ['127.0.0.1', 'localhost'],
    experimental: { proxyClientMaxBodySize: '32mb' },
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
              { source: '/management/:path*', destination: backend + '/management/:path*' },
            ]);
          },
        }
      : {}),
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

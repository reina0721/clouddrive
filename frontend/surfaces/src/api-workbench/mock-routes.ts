/**
 * In-memory Mock Server for API Workbench.
 *
 * Handles URLs starting with `mock://` without hitting any external network.
 * Provides realistic responses, headers, duration, and status codes for
 * testing, demonstration, assertion verification, and extractor pipelines.
 */

import type { ExecutedResponse, ResolvedRequest } from './model';

const initialMockUsers = [
  { id: 'usr_001', name: '张伟', email: 'zhangwei@example.com', role: 'admin', active: true },
  { id: 'usr_002', name: '李娜', email: 'lina@example.com', role: 'developer', active: true },
  { id: 'usr_003', name: '王强', email: 'wangqiang@example.com', role: 'viewer', active: false },
];

export async function dispatchMockRoute(req: ResolvedRequest): Promise<ExecutedResponse> {
  const startTime = Date.now();
  const urlString = req.url.replace(/^mock:\/\//, 'http://mock-internal/');
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return {
      status: 400,
      statusText: 'Bad Request',
      durationMs: Date.now() - startTime,
      sizeBytes: 0,
      headers: [['content-type', 'application/json']],
      body: JSON.stringify({ error: 'Invalid mock URL format' }, null, 2),
    };
  }

  const pathname = parsedUrl.pathname.replace(/\/$/, '') || '/';
  const method = req.method.toUpperCase();

  // Helper to construct response
  const makeResponse = (
    status: number,
    statusText: string,
    data: unknown,
    extraHeaders: readonly (readonly [string, string])[] = [],
  ): ExecutedResponse => {
    const bodyStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const duration = Math.max(1, Date.now() - startTime);
    return {
      status,
      statusText,
      durationMs: duration,
      sizeBytes: new Blob([bodyStr]).size,
      headers: [
        ['server', 'MockServer/1.0.0'],
        ['content-type', 'application/json; charset=utf-8'],
        ['date', new Date().toUTCString()],
        ...extraHeaders,
      ],
      body: bodyStr,
    };
  };

  // Route: /delay/:ms
  const delayMatch = pathname.match(/^\/delay\/(\d+)$/);
  if (delayMatch) {
    const ms = Math.min(5000, Math.max(10, parseInt(delayMatch[1] ?? '100', 10)));
    await new Promise((resolve) => setTimeout(resolve, ms));
    return makeResponse(200, 'OK', {
      delayed: true,
      durationRequestedMs: ms,
      timestamp: new Date().toISOString(),
    });
  }

  // Route: /status/:code
  const statusMatch = pathname.match(/^\/status\/(\d{3})$/);
  if (statusMatch) {
    const code = parseInt(statusMatch[1] ?? '200', 10);
    return makeResponse(code, code >= 400 ? 'Mock Error' : 'Mock Status', {
      status: code,
      message: `Mock response for status ${code}`,
      timestamp: new Date().toISOString(),
    });
  }

  // Route: /auth/login
  if (pathname === '/auth/login') {
    if (method === 'POST') {
      return makeResponse(200, 'OK', {
        code: 0,
        message: '登录成功',
        data: {
          token: 'mock_jwt_token_' + Math.random().toString(36).substring(2, 10),
          tokenType: 'Bearer',
          expiresIn: 7200,
          user: { id: 'usr_001', name: '张伟' },
        },
      });
    }
    return makeResponse(405, 'Method Not Allowed', { error: 'Use POST for /auth/login' });
  }

  // Route: /users
  if (pathname === '/users') {
    if (method === 'GET') {
      return makeResponse(200, 'OK', {
        code: 0,
        total: initialMockUsers.length,
        items: initialMockUsers,
      });
    }
    if (method === 'POST') {
      let payload: Record<string, unknown> = {};
      try {
        if (req.body) payload = JSON.parse(req.body) as Record<string, unknown>;
      } catch {
        // ignore
      }
      const newUser = {
        id: `usr_${Date.now().toString(36)}`,
        name: payload.name || '新用户',
        email: payload.email || 'user@example.com',
        role: payload.role || 'viewer',
        active: true,
      };
      return makeResponse(201, 'Created', {
        code: 0,
        message: '用户创建成功',
        data: newUser,
      });
    }
  }

  // Route: /users/:id
  const userMatch = pathname.match(/^\/users\/([^/]+)$/);
  if (userMatch) {
    const id = userMatch[1];
    const user = initialMockUsers.find((u) => u.id === id);
    if (user) {
      return makeResponse(200, 'OK', { code: 0, data: user });
    }
    return makeResponse(404, 'Not Found', { error: `User ${id} not found` });
  }

  // Route: /echo
  if (pathname === '/echo') {
    const queryEntries: Record<string, string> = {};
    parsedUrl.searchParams.forEach((val, key) => {
      queryEntries[key] = val;
    });

    let parsedBody: unknown = req.body;
    try {
      if (req.body) parsedBody = JSON.parse(req.body);
    } catch {
      // keep raw string
    }

    return makeResponse(200, 'OK', {
      echo: true,
      method: req.method,
      pathname,
      query: queryEntries,
      headers: req.headers,
      body: parsedBody,
      timestamp: new Date().toISOString(),
    });
  }

  // Fallback 404
  return makeResponse(404, 'Not Found', {
    error: 'Mock route not matched',
    requestedPath: pathname,
    method: req.method,
    availableRoutes: [
      '/users',
      '/users/:id',
      '/auth/login',
      '/echo',
      '/status/:code',
      '/delay/:ms',
    ],
  });
}

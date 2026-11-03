export class ApiError extends Error {
  constructor(
    public readonly code: 'http' | 'network' | 'timeout' | 'protocol',
    public readonly status = 0,
    public readonly payload: unknown = undefined,
  ) {
    super(`API: ${code}`);
    this.name = 'ApiError';
  }
}

/** Cookie/CSRF transport shared by auth and product adapters; never caches credentials or responses. */
export function createJsonClient(apiBaseUrl: string, request: typeof fetch = fetch) {
  return async (
    path: string,
    options: Readonly<{
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: unknown;
      timeoutMs?: number;
      headers?: Readonly<Record<string, string>>;
      signal?: AbortSignal;
      onResponse?: (response: Response) => void;
    }> = {},
  ): Promise<unknown> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    const signal = options.signal
      ? AbortSignal.any([controller.signal, options.signal])
      : controller.signal;
    const method = options.method ?? 'GET';
    try {
      let csrfToken: string | undefined;
      if (method !== 'GET') {
        const csrf = await request(`${apiBaseUrl}/auth/csrf`, {
          credentials: 'include',
          cache: 'no-store',
          signal,
        });
        if (!csrf.ok) throw new ApiError('http', csrf.status);
        const value: unknown = await csrf.json().catch(() => {
          throw new ApiError('protocol');
        });
        if (
          typeof value !== 'object' ||
          value === null ||
          !('token' in value) ||
          typeof value.token !== 'string' ||
          !value.token.trim() ||
          value.token.length > 4096
        )
          throw new ApiError('protocol');
        csrfToken = value.token;
      }
      const response = await request(`${apiBaseUrl}${path}`, {
        method,
        credentials: 'include',
        cache: 'no-store',
        signal,
        ...(method !== 'GET'
          ? {
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken ?? '',
                ...options.headers,
              },
              body: JSON.stringify(options.body),
            }
          : {}),
      });
      options.onResponse?.(response);
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => undefined);
        throw new ApiError('http', response.status, payload);
      }
      if (response.status === 204) return null;
      try {
        return await response.json();
      } catch {
        throw new ApiError('protocol');
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted ? 'timeout' : 'network');
    } finally {
      clearTimeout(timeout);
    }
  };
}

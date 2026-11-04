export class ApiError extends Error {
  constructor(
    public readonly code: 'http' | 'network' | 'timeout' | 'protocol' | 'limit',
    public readonly status = 0,
    public readonly payload: unknown = undefined,
    options?: ErrorOptions,
  ) {
    super(`API: ${code}`, options);
    this.name = 'ApiError';
  }
}

/** csrfTokenOf 复用同一受控协议校验，避免上传客户端建立另一套凭据读取规则。 */
export function csrfTokenOf(value: unknown): string {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('token' in value) ||
    typeof value.token !== 'string' ||
    !value.token.trim() ||
    value.token.length > 4096
  )
    throw new ApiError('protocol');
  return value.token;
}

/** createJsonClient 统一 Cookie/CSRF 传输；GET/HEAD 不获取写入令牌，也不缓存凭据或响应。 */
export function createJsonClient(apiBaseUrl: string, request: typeof fetch = fetch) {
  return async (
    path: string,
    options: Readonly<{
      method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: unknown;
      rawBody?: Blob;
      responseType?: 'json' | 'blob';
      maxBlobBytes?: number;
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
    const readOnly = method === 'GET' || method === 'HEAD';
    try {
      let csrfToken: string | undefined;
      if (!readOnly) {
        const csrf = await request(`${apiBaseUrl}/auth/csrf`, {
          credentials: 'include',
          cache: 'no-store',
          signal,
        });
        if (!csrf.ok) throw new ApiError('http', csrf.status);
        const value: unknown = await csrf.json().catch(() => {
          throw new ApiError('protocol');
        });
        csrfToken = csrfTokenOf(value);
      }
      const response = await request(`${apiBaseUrl}${path}`, {
        method,
        credentials: 'include',
        cache: 'no-store',
        signal,
        ...(!readOnly
          ? {
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken ?? '',
                ...options.headers,
              },
              body: options.rawBody ?? JSON.stringify(options.body),
            }
          : {}),
      });
      options.onResponse?.(response);
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => undefined);
        throw new ApiError('http', response.status, payload);
      }
      if (response.status === 204) return null;
      if (options.responseType === 'blob') {
        if (options.maxBlobBytes === undefined) return await response.blob();
        const { BlobBodyError, readBoundedBlob } = await import('./blob-body');
        try {
          return await readBoundedBlob(response, options.maxBlobBytes, signal);
        } catch (error) {
          if (error instanceof BlobBodyError && error.code === 'limit')
            throw new ApiError('limit', 0, undefined, { cause: error });
          throw error;
        }
      }
      try {
        return await response.json();
      } catch {
        throw new ApiError('protocol');
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted ? 'timeout' : 'network', 0, undefined, {
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  };
}

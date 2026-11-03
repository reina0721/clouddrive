import type { ApiRequestDefinition } from '@clouddrive/surface/api-workbench';

// History keeps variable references, but does not duplicate literal authentication secrets.
const referenceOnly = (value: string) => (/^(\{\{[^{}]+\}\})$/.test(value.trim()) ? value : '');

export function historyRequestSnapshot(request: ApiRequestDefinition): ApiRequestDefinition {
  const auth = request.auth;
  return {
    ...request,
    auth:
      auth.type === 'bearer'
        ? { ...auth, token: referenceOnly(auth.token) }
        : auth.type === 'basic'
          ? { ...auth, password: referenceOnly(auth.password) }
          : auth.type === 'api-key'
            ? { ...auth, value: referenceOnly(auth.value) }
            : auth,
    headers: request.headers.map((entry) =>
      /^(authorization|proxy-authorization|cookie|x-api-key)$/i.test(entry.key)
        ? { ...entry, value: referenceOnly(entry.value) }
        : entry,
    ),
  };
}

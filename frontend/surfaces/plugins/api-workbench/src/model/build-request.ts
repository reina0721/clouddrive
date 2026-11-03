import type { ApiRequestDefinition, ResolvedRequest } from '@clouddrive/surface/api-workbench';
import { interpolateString } from './interpolate';
import { base64Encode } from './crypto';

export function buildResolvedRequest(
  def: ApiRequestDefinition,
  variables: Record<string, string>,
): ResolvedRequest {
  // 1. Interpolate URL
  let targetUrl = interpolateString(def.url.trim(), variables);

  // 2. Query Params
  const queryParams: [string, string][] = [];
  for (const p of def.params) {
    if (p.enabled && p.key.trim()) {
      queryParams.push([
        interpolateString(p.key.trim(), variables),
        interpolateString(p.value, variables),
      ]);
    }
  }

  // 3. Headers
  const headerMap: Record<string, string> = {};
  for (const h of def.headers) {
    if (h.enabled && h.key.trim()) {
      headerMap[interpolateString(h.key.trim(), variables)] = interpolateString(h.value, variables);
    }
  }

  // 4. Auth
  if (def.auth.type === 'bearer' && def.auth.token.trim()) {
    headerMap['Authorization'] = `Bearer ${interpolateString(def.auth.token.trim(), variables)}`;
  } else if (def.auth.type === 'basic') {
    const user = interpolateString(def.auth.username, variables);
    const pass = interpolateString(def.auth.password, variables);
    headerMap['Authorization'] = `Basic ${base64Encode(`${user}:${pass}`)}`;
  } else if (def.auth.type === 'api-key') {
    const k = interpolateString(def.auth.key.trim(), variables);
    const v = interpolateString(def.auth.value, variables);
    if (k) {
      if (def.auth.in === 'header') {
        headerMap[k] = v;
      } else {
        queryParams.push([k, v]);
      }
    }
  }

  // Append query params to URL
  if (queryParams.length > 0) {
    const separator = targetUrl.includes('?') ? '&' : '?';
    const queryString = queryParams
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    targetUrl = `${targetUrl}${separator}${queryString}`;
  }

  // 5. Body
  let resolvedBody: string | undefined = undefined;
  if (def.method !== 'GET' && def.method !== 'HEAD') {
    if (def.body.type === 'json' || def.body.type === 'text' || def.body.type === 'xml') {
      resolvedBody = interpolateString(def.body.content, variables);
      if (def.body.type === 'json' && !headerMap['Content-Type']) {
        headerMap['Content-Type'] = 'application/json';
      }
    } else if (def.body.type === 'form-urlencoded') {
      const formEntries: string[] = [];
      for (const entry of def.body.entries) {
        if (entry.enabled && entry.key.trim()) {
          formEntries.push(
            `${encodeURIComponent(interpolateString(entry.key.trim(), variables))}=${encodeURIComponent(
              interpolateString(entry.value, variables),
            )}`,
          );
        }
      }
      resolvedBody = formEntries.join('&');
      if (!headerMap['Content-Type']) {
        headerMap['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }
  }

  return {
    method: def.method,
    url: targetUrl,
    headers: headerMap,
    body: resolvedBody,
    timeoutMs: def.disguise.timeoutMs || 10000,
    disguise: def.disguise,
  };
}

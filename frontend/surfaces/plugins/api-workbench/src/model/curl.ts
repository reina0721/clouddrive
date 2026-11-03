import type { HttpMethod, KeyValueEntry, RequestBody } from '@clouddrive/surface/api-workbench';

export type ParsedCurl = {
  method: HttpMethod;
  url: string;
  headers: KeyValueEntry[];
  body: RequestBody;
};

export function parseCurl(command: string): ParsedCurl | null {
  const trimmed = command.trim();
  if (!trimmed.toLowerCase().startsWith('curl')) return null;

  // Simple token regex handling quotes
  const tokenRegex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  const tokens: string[] = [];
  let match;
  while ((match = tokenRegex.exec(trimmed)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[0]);
  }

  let method: HttpMethod = 'GET';
  let url = '';
  const headers: KeyValueEntry[] = [];
  let bodyContent = '';
  let isJson = false;

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    if (token === '-X' || token === '--request') {
      const next = tokens[++i]?.toUpperCase();
      if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(next ?? '')) {
        method = next as HttpMethod;
      }
    } else if (token === '-H' || token === '--header') {
      const headerStr = tokens[++i] ?? '';
      const colonIndex = headerStr.indexOf(':');
      if (colonIndex > 0) {
        const key = headerStr.substring(0, colonIndex).trim();
        const value = headerStr.substring(colonIndex + 1).trim();
        headers.push({
          id: `h_${Math.random().toString(36).substring(2, 7)}`,
          key,
          value,
          enabled: true,
        });
        if (
          key.toLowerCase() === 'content-type' &&
          value.toLowerCase().includes('application/json')
        ) {
          isJson = true;
        }
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw') {
      bodyContent = tokens[++i] ?? '';
      if (method === 'GET') method = 'POST';
    } else if (!token.startsWith('-') && !url) {
      url = token;
    }
  }

  if (!url) return null;

  let body: RequestBody = { type: 'none' };
  if (bodyContent) {
    body = {
      type:
        isJson || bodyContent.trim().startsWith('{') || bodyContent.trim().startsWith('[')
          ? 'json'
          : 'text',
      content: bodyContent,
    };
  }

  return {
    method,
    url,
    headers,
    body,
  };
}

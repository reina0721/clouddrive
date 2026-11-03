import type { ExecutedResponse, Extractor } from '@clouddrive/surface/api-workbench';

export function evaluateJsonPath(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (!path || path === '$' || path === '.') return obj;

  // Normalize path: $.data.items[0].id -> ['data', 'items', '0', 'id']
  const cleanPath = path
    .replace(/^\$\.?/, '')
    .replace(/\[(\w+)\]/g, '.$1')
    .replace(/^\./, '');

  const segments = cleanPath.split('.').filter(Boolean);
  let current: unknown = obj;

  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }

  return current;
}

export function runExtractors(
  extractors: readonly Extractor[],
  response: ExecutedResponse,
): readonly { key: string; value: string; scope: 'env' | 'global' }[] {
  const extracted: { key: string; value: string; scope: 'env' | 'global' }[] = [];

  let parsedJsonBody: unknown = undefined;
  let hasParsedJson = false;

  const getJson = () => {
    if (!hasParsedJson) {
      hasParsedJson = true;
      try {
        parsedJsonBody = JSON.parse(response.body);
      } catch {
        parsedJsonBody = undefined;
      }
    }
    return parsedJsonBody;
  };

  for (const ext of extractors) {
    if (!ext.variable.trim()) continue;

    let value: unknown = undefined;

    if (ext.source === 'status') {
      value = response.status;
    } else if (ext.source === 'header') {
      const headerKey = ext.expression.trim().toLowerCase();
      const found = response.headers.find(([k]) => k.toLowerCase() === headerKey);
      value = found ? found[1] : undefined;
    } else if (ext.source === 'body-json') {
      const json = getJson();
      if (json !== undefined) {
        value = evaluateJsonPath(json, ext.expression);
      }
    }

    if (value !== undefined) {
      let strValue: string;
      if (typeof value === 'string') {
        strValue = value;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        strValue = String(value);
      } else {
        strValue = JSON.stringify(value);
      }
      extracted.push({
        key: ext.variable.trim(),
        value: strValue,
        scope: ext.scope,
      });
    }
  }

  return extracted;
}

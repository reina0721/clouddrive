import type { KeyValueEntry } from '@clouddrive/surface/api-workbench';

export function resolveVariableMap(
  envVars: readonly KeyValueEntry[] = [],
  globalVars: readonly KeyValueEntry[] = [],
): Record<string, string> {
  const map: Record<string, string> = {};

  // Globals first
  for (const entry of globalVars) {
    if (entry.enabled && entry.key.trim()) {
      map[entry.key.trim()] = entry.value;
    }
  }

  // Active environment overrides globals
  for (const entry of envVars) {
    if (entry.enabled && entry.key.trim()) {
      map[entry.key.trim()] = entry.value;
    }
  }

  return map;
}

export function interpolateString(template: string, variableMap: Record<string, string>): string {
  if (!template) return '';

  return template.replace(/\{\{([^{}]+)\}\}/g, (match, rawKey: string) => {
    const key = rawKey.trim();

    // Built-in dynamic variables
    if (key === '$timestamp') return String(Date.now());
    if (key === '$isoTimestamp') return new Date().toISOString();
    if (key === '$uuid') {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'uuid-' + Math.random().toString(36).substring(2, 10);
    }
    if (key === '$randomInt') return String(Math.floor(Math.random() * 1000));

    if (key in variableMap) {
      return variableMap[key] ?? '';
    }

    return match;
  });
}

/**
 * Formats a hostname or IP address for inclusion in a URL.
 * Encloses raw IPv6 addresses (containing colons and not already enclosed) in brackets.
 */
export function formatHostForUrl(host: string): string {
  const trimmed = host.trim();
  if (trimmed.includes(':') && !trimmed.startsWith('[') && !trimmed.endsWith(']')) {
    return `[${trimmed}]`;
  }
  return trimmed;
}

/**
 * Returns the URL that the server listens on (e.g. http://0.0.0.0:4173).
 */
export function getListenUrl(
  host: string,
  port: number,
  protocol: 'http' | 'https' = 'http',
): string {
  return `${protocol}://${formatHostForUrl(host)}:${port}`;
}

/**
 * Resolves a listen host to an accessible client probe host.
 * Wildcard bind addresses (0.0.0.0, ::) are mapped to loopback (127.0.0.1, [::1])
 * because client fetch / browser cannot connect to wildcard addresses directly.
 */
export function getProbeHost(host: string): string {
  const trimmed = host.trim();
  if (trimmed === '0.0.0.0') {
    return '127.0.0.1';
  }
  if (trimmed === '::' || trimmed === '[::]') {
    return '[::1]';
  }
  return formatHostForUrl(trimmed);
}

/**
 * Returns the URL that clients or test runners can use to probe or access the server.
 */
export function getProbeUrl(
  host: string,
  port: number,
  protocol: 'http' | 'https' = 'http',
): string {
  return `${protocol}://${getProbeHost(host)}:${port}`;
}

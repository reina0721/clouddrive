/** The upstream is server configuration; request paths must never choose its host. */
export function backendDestination(
  requestUrl: string,
  backend = process.env.CLOUDDRIVE_BACKEND_URL ?? 'http://127.0.0.1:8080',
): URL {
  let destination: URL;
  try {
    destination = new URL(backend);
  } catch {
    throw new Error('CLOUDDRIVE_BACKEND_URL must be an HTTP(S) origin.');
  }
  if (
    !['http:', 'https:'].includes(destination.protocol) ||
    destination.username ||
    destination.password ||
    destination.pathname !== '/' ||
    destination.search ||
    destination.hash
  )
    throw new Error('CLOUDDRIVE_BACKEND_URL must be an HTTP(S) origin.');
  const incoming = new URL(requestUrl);
  destination.pathname = incoming.pathname;
  destination.search = incoming.search;
  return destination;
}

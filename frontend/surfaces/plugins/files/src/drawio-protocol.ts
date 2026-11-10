export const emptyDrawio =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';
export const drawioHandshakeTimeoutMs = 15_000;
const maxEnvelopeCharacters = 16 * 1024;

/** drawioEndpoint 要求独立主机名，避免不同端口共享文件站点的 Cookie。 */
export function drawioEndpoint(
  configured: string,
  hostOrigin: string,
  language: 'zh' | 'en',
  platform: 'desktop' | 'mobile' = 'desktop',
) {
  try {
    const url = new URL(configured);
    const host = new URL(hostOrigin);
    const loopback =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    if (
      (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) ||
      url.hostname.replace(/\.$/, '') === host.hostname.replace(/\.$/, '') ||
      url.username ||
      url.password ||
      url.hash ||
      url.search
    )
      return undefined;
    url.search = new URLSearchParams({
      embed: '1',
      proto: 'json',
      spin: '1',
      configure: '1',
      libraries: '1',
      saveAndExit: '1',
      lang: language,
      ...(platform === 'mobile' ? { ui: 'min', format: '0', sidebar: '0' } : {}),
    }).toString();
    return url;
  } catch {
    return undefined;
  }
}

type DrawioMessage =
  | { event: 'configure' | 'init' }
  | { event: 'exit'; modified: boolean }
  | { event: 'autosave' | 'save'; xml: string; exit: boolean };

/** drawioMessage 仅解析当前框架与信任来源发送的有界 JSON 消息。 */
export function drawioMessage(
  message: MessageEvent<unknown>,
  frame: Window,
  origin: string,
  maxBytes: number,
): DrawioMessage | undefined {
  if (
    message.source !== frame ||
    message.origin !== origin ||
    typeof message.data !== 'string' ||
    message.data.length > maxBytes * 6 + maxEnvelopeCharacters
  )
    return undefined;
  try {
    const data: unknown = JSON.parse(message.data);
    if (!data || typeof data !== 'object' || !('event' in data)) return undefined;
    switch (data.event) {
      case 'configure':
      case 'init':
        return { event: data.event };
      case 'exit':
        return { event: 'exit', modified: 'modified' in data && data.modified === true };
      case 'autosave':
      case 'save':
        if ('xml' in data && typeof data.xml === 'string')
          return { event: data.event, xml: data.xml, exit: 'exit' in data && data.exit === true };
    }
  } catch {
    // 非 JSON 或不符合协议的消息不参与图表状态。
  }
  return undefined;
}

/** validDrawioXML 确保图表格式可交给编辑器，宿主从不插入 XML 中的节点。 */
export function validDrawioXML(xml: string) {
  if (!xml.trim() || /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) return false;
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const root = document.documentElement;
  return (
    !root.namespaceURI &&
    !document.querySelector('parsererror') &&
    (root.localName === 'mxfile' || root.localName === 'mxGraphModel')
  );
}

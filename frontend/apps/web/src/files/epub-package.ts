import {
  epubLimits,
  FilesError,
  type EpubDestination,
  type EpubTocEntry,
} from '@clouddrive/surface/files';

export type EpubResource = Readonly<{ path: string; mediaType: string; properties: string }>;
type ReadMember = (path: string, maxBytes: number, signal: AbortSignal) => Promise<Uint8Array>;
const xmlEntities = new Set(['&amp;', '&lt;', '&gt;', '&quot;', '&apos;']);

export function parseEpubXML(bytes: Uint8Array) {
  const decoded = new TextDecoder('utf-8', { fatal: true })
    .decode(bytes)
    .replace(/<!DOCTYPE\s+(?:html|ncx|package)\b[^<>[\]]*>/i, '');
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(decoded)) throw new FilesError('unsupported');
  const parser = new DOMParser();
  const entities = new Map<string, string>();
  // 老 XHTML 常使用命名字符。HTML 解析器只接收单个实体，输出再编码为 XML 数值实体。
  const markup = decoded.replace(/&[a-z][a-z0-9]{1,31};/gi, (entity) => {
    if (xmlEntities.has(entity)) return entity;
    const cached = entities.get(entity);
    if (cached !== undefined) return cached;
    if (entities.size >= 256) throw new FilesError('large');
    const text = parser.parseFromString(entity, 'text/html').body.textContent;
    const replacement =
      text && text !== entity
        ? Array.from(text, (character) => `&#${character.codePointAt(0)!};`).join('')
        : entity;
    entities.set(entity, replacement);
    return replacement;
  });
  const document = parser.parseFromString(markup, 'application/xml');
  if (document.getElementsByTagNameNS('*', 'parsererror').length)
    throw new FilesError('unsupported');
  return document;
}

function elements(parent: Document | Element, name: string) {
  return Array.from(parent.getElementsByTagNameNS('*', name));
}

// resolveEpubPath 使用包内路径。绝对地址、越出包根及含查询的链接均无目标。
export function resolveEpubPath(base: string, href: string) {
  if (href.length > 4096) return undefined;
  try {
    const [pathname = '', fragment] = href.trim().split('#', 2);
    const relative = decodeURIComponent(pathname);
    if (
      relative.startsWith('/') ||
      /[:?\\]/.test(relative) ||
      Array.from(relative).some((character) => character.charCodeAt(0) < 32) ||
      (!relative && !fragment)
    )
      return undefined;
    const parts = base.split('/');
    if (relative) {
      parts.pop();
      for (const part of relative.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') {
          if (!parts.length) return undefined;
          parts.pop();
        } else parts.push(part);
      }
    }
    const path = parts.join('/');
    const anchor = fragment ? decodeURIComponent(fragment) : undefined;
    if (!path || path.length > 4096 || (anchor && anchor.length > 512)) return undefined;
    return { path, ...(anchor ? { fragment: anchor } : {}) };
  } catch {
    return undefined;
  }
}

export function epubDestination(
  chapters: readonly string[],
  source: string,
  href: string,
): EpubDestination | undefined {
  const resolved = resolveEpubPath(source, href);
  if (!resolved) return undefined;
  const chapter = chapters.indexOf(resolved.path);
  return chapter < 0
    ? undefined
    : { chapter, ...(resolved.fragment ? { fragment: resolved.fragment } : {}) };
}

export async function readEpubPackage(read: ReadMember, signal: AbortSignal) {
  const marker = await read('mimetype', 64, signal);
  if (new TextDecoder().decode(marker) !== 'application/epub+zip')
    throw new FilesError('unsupported');
  const xml = async (path: string) => parseEpubXML(await read(path, epubLimits.xmlBytes, signal));
  const container = await xml('META-INF/container.xml');
  const rootfile = elements(container, 'rootfile').find(
    (file) => file.getAttribute('media-type') === 'application/oebps-package+xml',
  );
  const packagePath = resolveEpubPath('', rootfile?.getAttribute('full-path') ?? '')?.path;
  if (!packagePath) throw new FilesError('unsupported');
  const manifest = await xml(packagePath);
  const resources = new Map<string, EpubResource>();
  const byID = new Map<string, EpubResource>();
  for (const item of elements(manifest, 'item')) {
    const id = item.getAttribute('id');
    const path = resolveEpubPath(packagePath, item.getAttribute('href') ?? '')?.path;
    if (!id || byID.has(id)) throw new FilesError('unsupported');
    if (!path) continue;
    const resource = {
      path,
      mediaType: item.getAttribute('media-type') ?? '',
      properties: item.getAttribute('properties') ?? '',
    };
    byID.set(id, resource);
    resources.set(path, resource);
  }
  const spine = elements(manifest, 'spine')[0];
  const chapters = spine
    ? elements(spine, 'itemref').map((reference) => {
        const resource = byID.get(reference.getAttribute('idref') ?? '');
        if (!resource || !['application/xhtml+xml', 'text/html'].includes(resource.mediaType))
          throw new FilesError('unsupported');
        return resource.path;
      })
    : [];
  if (!chapters.length || chapters.length > epubLimits.packageEntries)
    throw new FilesError('unsupported');

  const navigation = [...byID.values()].find((resource) =>
    resource.properties.split(/\s+/).includes('nav'),
  );
  const ncx = byID.get(spine?.getAttribute('toc') ?? '');
  const toc: EpubTocEntry[] = [];
  const append = (source: string, href: string, label: string) => {
    const destination = epubDestination(chapters, source, href);
    if (destination && label && toc.length < epubLimits.packageEntries)
      toc.push({ destination, label: label.trim().slice(0, 512) });
  };
  try {
    if (navigation) {
      const document = await xml(navigation.path);
      const nav = elements(document, 'nav').find((node) =>
        (node.getAttributeNS('http://www.idpf.org/2007/ops', 'type') ?? '')
          .split(/\s+/)
          .includes('toc'),
      );
      if (nav)
        for (const link of elements(nav, 'a'))
          append(navigation.path, link.getAttribute('href') ?? '', link.textContent ?? '');
    } else if (ncx) {
      const document = await xml(ncx.path);
      for (const point of elements(document, 'navPoint')) {
        const content = Array.from(point.children).find((node) => node.localName === 'content');
        const label = Array.from(point.children).find((node) => node.localName === 'navLabel');
        append(ncx.path, content?.getAttribute('src') ?? '', label?.textContent ?? '');
      }
    }
  } catch (error) {
    if (signal.aborted) throw error;
    if (!(error instanceof FilesError) && !(error instanceof TypeError)) throw error;
    // 可选目录损坏时保留 spine，章节本身仍可逐页读取。
  }
  const metadata = elements(manifest, 'metadata')[0];
  const field = (name: string) =>
    metadata ? (elements(metadata, name)[0]?.textContent ?? '').trim().slice(0, 512) : '';
  return { title: field('title'), author: field('creator'), chapters, toc, resources };
}

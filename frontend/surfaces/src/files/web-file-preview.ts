import type { WebFilePreview } from './file-applications';

const templateVariables = ['src', 'src_raw', 'src_raw_base64', 'name', 'theme', 'dark'] as const;
type Variable = (typeof templateVariables)[number];
const variablePattern = /\{\$([a-z_]+)\}/g;

function readTemplate(value: string) {
  if (value.length > 2048 || /[\p{Cc}\s\\#]/u.test(value)) return undefined;
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    return undefined;
  }
  if (
    target.protocol !== 'https:' ||
    target.username ||
    target.password ||
    /[{}]/.test(target.host + target.pathname)
  )
    return undefined;
  let hasSource = false;
  for (const [key, argument] of target.searchParams) {
    if (!key || /[{}]/.test(key + argument.replace(variablePattern, ''))) return undefined;
    for (const match of argument.matchAll(variablePattern)) {
      const variable = match[1] as Variable;
      if (!templateVariables.includes(variable)) return undefined;
      if (variable === 'src' || variable === 'src_raw' || variable === 'src_raw_base64')
        hasSource = true;
    }
  }
  return hasSource ? target : undefined;
}

export function webFilePreviewOrigin(template: string) {
  return readTemplate(template)?.origin;
}

export function webFilePreviewURL(preview: WebFilePreview, siteOrigin: string, dark: boolean) {
  const target = readTemplate(preview.urlTemplate);
  if (!target || target.origin !== new URL(preview.origin).origin || target.origin === siteOrigin)
    throw new Error('Invalid web file preview origin');
  const source = new URL('/api/v1/file-web-previews/' + preview.token, siteOrigin).href;
  const values: Record<Variable, string> = {
    src: encodeURIComponent(source),
    src_raw: source,
    src_raw_base64: encodeURIComponent(btoa(source)),
    name: encodeURIComponent(preview.name),
    theme: dark ? 'dark' : 'light',
    dark: dark ? '1' : '0',
  };
  const query = Array.from(target.searchParams, ([key, argument]) => {
    let position = 0;
    let expanded = '';
    for (const match of argument.matchAll(variablePattern)) {
      expanded +=
        encodeURIComponent(argument.slice(position, match.index)) + values[match[1] as Variable];
      position = match.index + match[0].length;
    }
    return encodeURIComponent(key) + '=' + expanded + encodeURIComponent(argument.slice(position));
  });
  target.search = query.join('&');
  return target.href;
}

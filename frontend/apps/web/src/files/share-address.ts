import { FilesError } from '@clouddrive/surface/files';
import type { SiteAddresses } from '@clouddrive/surface/administration';
import { fileDestinationHrefs } from './destinations';

export const shareTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const sharePath = '/share';
const tokenKey = 'token';
const saveIntentKey = 'saveShare';

/** fileShareAddress 保持公开分享标识在fragment，不放入服务器路径或query。 */
export function fileShareAddress(token: string, origin: string): string {
  if (!shareTokenPattern.test(token)) throw new FilesError('missing');
  return origin + sharePath + '#' + new URLSearchParams({ [tokenKey]: token }).toString();
}
export function parseFileShareAddress(
  value: string,
  origin: string,
  sites?: SiteAddresses,
): string {
  let address: URL;
  try {
    address = new URL(value, origin);
  } catch (error) {
    throw new FilesError('invalid', { cause: error });
  }
  const fragment = new URLSearchParams(address.hash.slice(1));
  const token = fragment.get(tokenKey) ?? '';
  if (
    (address.origin !== origin &&
      address.origin !== sites?.primary &&
      !sites?.alternatives.includes(address.origin)) ||
    address.pathname !== sharePath ||
    address.search ||
    address.username ||
    address.password ||
    [...fragment].length !== 1 ||
    !shareTokenPattern.test(token)
  )
    throw new FilesError('invalid');
  return token;
}
export function saveShareIntentHref(token: string): string {
  if (!shareTokenPattern.test(token)) throw new FilesError('missing');
  return (
    fileDestinationHrefs.shared + '#' + new URLSearchParams({ [saveIntentKey]: token }).toString()
  );
}
export function readShareSaveIntent(hash: string, origin: string): string | null {
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  if (!fragment.has(saveIntentKey)) return null;
  const token = fragment.get(saveIntentKey) ?? '';
  if ([...fragment].length !== 1 || !shareTokenPattern.test(token)) throw new FilesError('invalid');
  return fileShareAddress(token, origin);
}
export function withoutShareSaveIntent(hash: string): string {
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  fragment.delete(saveIntentKey);
  return fragment.size ? '#' + fragment.toString() : '';
}

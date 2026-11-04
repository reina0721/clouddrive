import type { PublicFileEntry, PublicFileQuery } from '../../../src/files/sharing';

export const initialPublicQuery: PublicFileQuery = {
  parent: '',
  search: '',
  sort: 'name',
  desc: false,
  scope: 'folder',
  page: 1,
};
export function publicTextEntry(entry: PublicFileEntry): boolean {
  return (
    entry.kind === 'file' && (/^text\//.test(entry.mediaType) || /\.(txt|md)$/i.test(entry.name))
  );
}
export function publicMediaEntry(entry: PublicFileEntry): boolean {
  return (
    entry.kind === 'file' &&
    /^(image\/(png|jpeg|gif|webp|avif)|audio\/|video\/)/.test(entry.mediaType)
  );
}

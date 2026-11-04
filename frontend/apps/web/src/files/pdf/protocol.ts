import type { PDFReaderLimits } from '@clouddrive/surface/files';
export const pdfProtocolVersion = 1;
export const pdfWorkerReadyKind = 'clouddrive-pdf-worker-ready';
export const pdfThumbnailPageSize = 8;
export const pdfPasswordMaxLength = 1024;
export const pdfSearchMaxLength = 512;
export const pdfOutlineTitleMaxLength = 4096;
export const pdfHistoryLimit = 200;
export const pdfMinScale = 0.25;
export const pdfMaxScale = 4;
export type PdfEditorMode = 'none' | 'text' | 'highlight' | 'ink';
export type PdfTheme = 'light' | 'dark';
export type PdfFailure = 'invalid' | 'limit' | 'worker' | 'timeout' | 'unavailable';
export type PdfOutline = Readonly<{
  id: string;
  title: string;
  navigable: boolean;
  items: readonly PdfOutline[];
}>;
export type PdfReaderState = Readonly<{
  page: number;
  pages: number;
  scale: number;
  rotation: number;
  rendered: boolean;
  matchesCurrent: number;
  matchesTotal: number;
  searchPending: boolean;
  modified: boolean;
  undo: boolean;
  redo: boolean;
  editor: PdfEditorMode;
  historyBack: boolean;
  historyForward: boolean;
}>;
export const emptyPdfState: PdfReaderState = {
  page: 1,
  pages: 0,
  scale: 1,
  rotation: 0,
  rendered: false,
  matchesCurrent: 0,
  matchesTotal: 0,
  searchPending: false,
  modified: false,
  undo: false,
  redo: false,
  editor: 'none',
  historyBack: false,
  historyForward: false,
};
export type PdfCommand =
  | { kind: 'page'; page: number }
  | { kind: 'scale'; scale: number | 'page-fit' | 'page-width' }
  | { kind: 'rotate'; direction: -1 | 1 }
  | {
      kind: 'find';
      query: string;
      caseSensitive: boolean;
      wholeWord: boolean;
      previous: boolean;
      again: boolean;
    }
  | { kind: 'outline' }
  | { kind: 'destination'; destinationId: string }
  | { kind: 'history'; direction: -1 | 1 }
  | { kind: 'thumbnail'; page: number }
  | { kind: 'editor'; mode: PdfEditorMode }
  | { kind: 'edit'; action: 'undo' | 'redo' }
  | { kind: 'save' }
  | { kind: 'exported' }
  | { kind: 'destroy' };
export type PdfOpen = {
  kind: 'open';
  nonce: string;
  id: number;
  limits: PDFReaderLimits;
  bytes: ArrayBuffer;
  locale: string;
  theme: PdfTheme;
};
export type PdfRequest = PdfCommand & { nonce: string; id: number };
export type PdfEvent =
  | { kind: 'boot'; version: number }
  | { kind: 'state'; nonce: string; state: PdfReaderState }
  | { kind: 'ready'; nonce: string; state: PdfReaderState }
  | { kind: 'worker-ready'; nonce: string }
  | { kind: 'password'; nonce: string; incorrect: boolean }
  | { kind: 'error'; nonce: string; id?: number; code: PdfFailure }
  | {
      kind: 'result';
      nonce: string;
      id: number;
      outline?: readonly PdfOutline[];
      bytes?: ArrayBuffer;
      page?: number;
    }
  | { kind: 'closed'; nonce: string; id: number }
  | { kind: 'close-request'; nonce: string };
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const positive = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const kinds = new Set([
  'page',
  'scale',
  'rotate',
  'find',
  'outline',
  'destination',
  'history',
  'thumbnail',
  'editor',
  'edit',
  'save',
  'exported',
  'destroy',
]);
export function isPdfCommand(value: unknown): value is PdfRequest {
  if (
    !record(value) ||
    typeof value.nonce !== 'string' ||
    !positive(value.id) ||
    typeof value.kind !== 'string' ||
    !kinds.has(value.kind)
  )
    return false;
  switch (value.kind) {
    case 'page':
    case 'thumbnail':
      return positive(value.page);
    case 'scale':
      return (
        value.scale === 'page-fit' ||
        value.scale === 'page-width' ||
        (typeof value.scale === 'number' &&
          Number.isFinite(value.scale) &&
          value.scale >= pdfMinScale &&
          value.scale <= pdfMaxScale)
      );
    case 'rotate':
    case 'history':
      return value.direction === -1 || value.direction === 1;
    case 'find':
      return (
        typeof value.query === 'string' &&
        value.query.length <= pdfSearchMaxLength &&
        typeof value.caseSensitive === 'boolean' &&
        typeof value.wholeWord === 'boolean' &&
        typeof value.previous === 'boolean' &&
        typeof value.again === 'boolean'
      );
    case 'destination':
      return typeof value.destinationId === 'string' && value.destinationId.length <= 128;
    case 'editor':
      return ['none', 'text', 'highlight', 'ink'].includes(String(value.mode));
    case 'edit':
      return value.action === 'undo' || value.action === 'redo';
    default:
      return true;
  }
}
export function isPdfOpen(value: unknown): value is PdfOpen {
  if (
    !record(value) ||
    value.kind !== 'open' ||
    typeof value.nonce !== 'string' ||
    value.nonce.length > 128 ||
    !positive(value.id) ||
    !(value.bytes instanceof ArrayBuffer) ||
    !record(value.limits) ||
    typeof value.locale !== 'string' ||
    value.locale.length > 20 ||
    (value.theme !== 'light' && value.theme !== 'dark')
  )
    return false;
  const fields = [
    'maxBytes',
    'maxPages',
    'maxCanvasPixels',
    'maxImagePixels',
    'maxOutlineEntries',
    'maxOutlineDepth',
    'maxThumbnailPixels',
    'maxThumbnailBytes',
    'workTimeoutMs',
    'workerReadyTimeoutMs',
  ];
  return (
    fields.every((key) => positive((value.limits as Record<string, unknown>)[key])) &&
    value.bytes.byteLength <= Number(value.limits.maxBytes)
  );
}
export function isPdfReaderState(value: unknown): value is PdfReaderState {
  if (!record(value)) return false;
  return (
    ['page', 'pages', 'matchesCurrent', 'matchesTotal'].every(
      (key) =>
        typeof value[key] === 'number' &&
        Number.isSafeInteger(value[key]) &&
        Number(value[key]) >= 0,
    ) &&
    typeof value.scale === 'number' &&
    Number.isFinite(value.scale) &&
    value.scale > 0 &&
    typeof value.rotation === 'number' &&
    value.rotation % 90 === 0 &&
    [
      'rendered',
      'searchPending',
      'modified',
      'undo',
      'redo',
      'historyBack',
      'historyForward',
    ].every((key) => typeof value[key] === 'boolean') &&
    ['none', 'text', 'highlight', 'ink'].includes(String(value.editor))
  );
}

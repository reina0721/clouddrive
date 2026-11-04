import type * as SDKCore from 'pdfjs-dist';
import type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
  PDFWorker as SDKWorker,
  RenderTask,
} from 'pdfjs-dist';
import type { PDFViewer } from 'pdfjs-dist/types/web/pdf_viewer';
import type { EventBus } from 'pdfjs-dist/types/web/event_utils';
import type { PDFLinkService } from 'pdfjs-dist/types/web/pdf_link_service';
import type { PDFFindController } from 'pdfjs-dist/types/web/pdf_find_controller';
import type { GenericL10n } from 'pdfjs-dist/types/web/genericl10n';
import {
  isPdfOpen,
  isPdfCommand,
  emptyPdfState,
  pdfProtocolVersion,
  pdfWorkerReadyKind,
  pdfOutlineTitleMaxLength,
  pdfHistoryLimit,
  pdfMinScale,
  pdfMaxScale,
  pdfPasswordMaxLength,
  type PdfOpen,
  type PdfRequest,
  type PdfEvent,
  type PdfReaderState,
  type PdfOutline,
  type PdfEditorMode,
  type PdfFailure,
} from '../protocol.js';

type Core = typeof SDKCore;
type ViewSDK = {
  PDFViewer: typeof PDFViewer;
  EventBus: typeof EventBus;
  PDFLinkService: typeof PDFLinkService;
  PDFFindController: typeof PDFFindController;
  GenericL10n: typeof GenericL10n;
  FindState: { PENDING: number };
  RenderingStates: { FINISHED: number };
};
let core: Core | undefined,
  ui: ViewSDK | undefined,
  doc: PDFDocumentProxy | undefined,
  loading: PDFDocumentLoadingTask | undefined,
  worker: Worker | undefined,
  sdkWorker: SDKWorker | undefined,
  viewer: PDFViewer | undefined,
  links: PDFLinkService | undefined,
  bus: EventBus | undefined;
let opening: PdfOpen | undefined,
  closed = false,
  ready = false;
let state: PdfReaderState = { ...emptyPdfState };
let passwordUpdater: ((password: string) => void) | undefined;
let thumbnailTask: RenderTask | undefined,
  thumbnailBusy = false;
type Position = { page: number; scale: number; top: number; left: number };
const navigation: Position[] = [];
const capture = (): Position | undefined =>
  viewer
    ? {
        page: viewer.currentPageNumber,
        scale: viewer.currentScale,
        top: viewer.container.scrollTop,
        left: viewer.container.scrollLeft,
      }
    : undefined;
let navigationIndex = -1,
  navigatingHistory = false;
const destinations = new Map<string, unknown>();
let searchQuery = '';
const frameLifetime = new AbortController();
async function waitForWorker(owned: Worker, signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      owned.removeEventListener('message', receive);
      owned.removeEventListener('error', failed);
      signal.removeEventListener('abort', aborted);
    };
    const receive = (event: MessageEvent<unknown>) => {
      if (
        typeof event.data === 'object' &&
        event.data !== null &&
        'kind' in event.data &&
        event.data.kind === pdfWorkerReadyKind
      ) {
        cleanup();
        resolve();
      }
    };
    const failed = (event: ErrorEvent) => {
      cleanup();
      const cause: unknown = event.error;
      reject(new Error('PDF worker unavailable', { cause }));
    };
    const aborted = () => {
      cleanup();
      reject(new Error('PDF worker canceled', { cause: signal.reason }));
    };
    if (signal.aborted) {
      aborted();
      return;
    }
    owned.addEventListener('message', receive);
    owned.addEventListener('error', failed);
    signal.addEventListener('abort', aborted, { once: true });
  });
}
let pendingEditorChange:
  { listener: (value: unknown) => void; reject: (error: Error) => void } | undefined;
function cancelEditorChange() {
  if (pendingEditorChange) {
    bus?.off('annotationeditormodechanged', pendingEditorChange.listener);
    pendingEditorChange.reject(new Error('PDF editor canceled'));
    pendingEditorChange = undefined;
  }
}
async function selectEditorMode(mode: number) {
  const activeViewer = viewer,
    activeBus = bus;
  if (!activeViewer || !activeBus) throw new Error('PDF editor unavailable');
  // 6.4.299声明误将getter推断成setter对象；官方实现实际返回数字枚举。
  const currentMode: unknown = activeViewer.annotationEditorMode;
  if (currentMode === mode && !pendingEditorChange) return;
  if (pendingEditorChange) throw new Error('PDF editor busy');
  // setter启动异步切换；只有SDK完成事件才确认成功，父会话负责操作期限。
  await new Promise<void>((resolve, reject) => {
    const listener = (value: unknown) => {
      if ((value as { mode?: unknown }).mode !== mode) return;
      activeBus.off('annotationeditormodechanged', listener);
      pendingEditorChange = undefined;
      resolve();
    };
    pendingEditorChange = { listener, reject };
    activeBus.on('annotationeditormodechanged', listener);
    try {
      activeViewer.annotationEditorMode = { mode };
    } catch (error) {
      activeBus.off('annotationeditormodechanged', listener);
      pendingEditorChange = undefined;
      reject(
        error instanceof Error ? error : new Error('PDF editor mode failed', { cause: error }),
      );
    }
  });
}
let uncommittedText = false;
let exportedHash = '',
  pendingExportHash: string | undefined,
  modifiedFrame: number | undefined;
// 采用SDK的实际序列化摘要，覆盖导出后撤销/重做及同一个编辑器再次修改；不复制PDF序列化逻辑。
function syncModified() {
  if (doc && !closed)
    state = {
      ...state,
      modified: uncommittedText || doc.annotationStorage.serializable.hash !== exportedHash,
    };
}
function scheduleModified() {
  if (modifiedFrame !== undefined || closed) return;
  modifiedFrame = requestAnimationFrame(() => {
    modifiedFrame = undefined;
    try {
      syncModified();
      publish();
    } catch {
      fail('unavailable');
    }
  });
}

const post = (event: PdfEvent, transfer: Transferable[] = []) => {
  if (!closed) parent.postMessage(event, location.origin, transfer);
};
const fail = (code: PdfFailure, id?: number) => {
  if (opening)
    post({ kind: 'error', nonce: opening.nonce, code, ...(id === undefined ? {} : { id }) });
};
function publish() {
  if (!opening || !viewer || !doc) return;
  state = {
    ...state,
    page: viewer.currentPageNumber,
    pages: doc.numPages,
    scale: viewer.currentScale,
    rotation: viewer.pagesRotation,
    rendered:
      (viewer.getPageView(viewer.currentPageNumber - 1) as { renderingState: number } | undefined)
        ?.renderingState === ui?.RenderingStates.FINISHED,
    historyBack: navigationIndex > 0,
    historyForward: navigationIndex >= 0 && navigationIndex < navigation.length - 1,
  };
  post({ kind: 'state', nonce: opening.nonce, state });
}
function remember() {
  const position = capture();
  if (navigatingHistory || !position) return;
  const prior = navigation[navigationIndex];
  if (
    prior &&
    prior.page === position.page &&
    prior.scale === position.scale &&
    Math.abs(prior.top - position.top) < 1 &&
    Math.abs(prior.left - position.left) < 1
  )
    return;
  navigation.splice(navigationIndex + 1);
  navigation.push(position);
  if (navigation.length > pdfHistoryLimit) navigation.shift();
  navigationIndex = navigation.length - 1;
}
const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
async function dispose(id: number) {
  if (closed) return;
  const nonce = opening?.nonce;
  closed = true;
  frameLifetime.abort();
  cancelEditorChange();
  passwordUpdater = undefined;
  thumbnailTask?.cancel();
  if (modifiedFrame !== undefined) cancelAnimationFrame(modifiedFrame);
  modifiedFrame = undefined;
  pendingExportHash = undefined;
  const errors: unknown[] = [];
  try {
    viewer?.cleanup();
  } catch (error) {
    errors.push(error);
  }
  try {
    if (loading) await loading.destroy();
  } catch (error) {
    errors.push(error);
  }
  try {
    sdkWorker?.destroy();
  } catch (error) {
    errors.push(error);
  }
  worker?.terminate();
  viewer = undefined;
  doc = undefined;
  loading = undefined;
  worker = undefined;
  sdkWorker = undefined;
  destinations.clear();
  if (nonce)
    parent.postMessage(
      errors.length
        ? { kind: 'error', nonce, id, code: 'unavailable' }
        : { kind: 'closed', nonce, id },
      location.origin,
    );
}
async function open(message: PdfOpen) {
  if (opening || closed) return;
  opening = message;
  document.documentElement.lang = message.locale;
  document.documentElement.style.colorScheme = message.theme;
  const container = document.getElementById('viewerContainer');
  if (!(container instanceof HTMLDivElement)) throw new Error('PDF container missing');
  container.setAttribute(
    'aria-label',
    message.locale.startsWith('zh') ? 'PDF文档视图' : 'PDF document view',
  );
  const assets = new URL('../assets/', import.meta.url);
  core = (await import(new URL('pdf.min.mjs', assets).href)) as Core;
  if (closed) return;
  ui = (await import(new URL('pdf_viewer.mjs', assets).href)) as ViewSDK;
  if (closed) return;
  worker = new Worker(new URL('./worker.js', import.meta.url), {
    type: 'module',
    name: 'clouddrive-pdf',
  });
  worker.addEventListener('error', (event) => {
    event.preventDefault();
    fail('worker');
  });
  await waitForWorker(worker, frameLifetime.signal);
  if (closed) return;
  sdkWorker = core.PDFWorker.create({ port: worker, verbosity: core.VerbosityLevel.ERRORS });
  await sdkWorker.promise;
  if (opening) post({ kind: 'worker-ready', nonce: opening.nonce });
  if (closed) return;
  bus = new ui.EventBus();
  links = new ui.PDFLinkService({ eventBus: bus });
  links.externalLinkEnabled = false;
  const find = new ui.PDFFindController({
    eventBus: bus,
    linkService: links,
    updateMatchesCountOnProgress: false,
  });
  const l10n = new ui.GenericL10n(message.locale);
  viewer = new ui.PDFViewer({
    container,
    eventBus: bus,
    linkService: links,
    findController: find,
    l10n,
    maxCanvasPixels: message.limits.maxCanvasPixels,
    maxCanvasDim: Math.floor(Math.sqrt(message.limits.maxCanvasPixels)),
    enableDetailCanvas: false,
    removePageBorders: true,
    annotationEditorMode: core.AnnotationEditorType.NONE,
  });
  await l10n.translate(container);
  if (closed) return;
  links.setViewer(viewer);
  // 只包装公开跳转入口；PDF内部链接和大纲共享有界、局部的位置历史，不改浏览器联合历史。
  const goToDestination = links.goToDestination.bind(links);
  links.goToDestination = async (destination) => {
    remember();
    navigatingHistory = true;
    try {
      await goToDestination(destination);
      await nextPaint();
    } finally {
      navigatingHistory = false;
    }
    remember();
    publish();
  };
  bus.on('pagesinit', () => {
    if (viewer) {
      viewer.currentScaleValue = 'page-width';
      remember();
      publish();
    }
  });
  bus.on('pagechanging', () => {
    if (viewer) {
      remember();
      publish();
    }
  });
  bus.on('scalechanging', publish);
  bus.on('rotationchanging', publish);
  bus.on('pagerendered', (value: unknown) => {
    const event = value as { pageNumber?: number; error?: unknown };
    if (event.error) {
      if ((event.error as { name?: string }).name !== 'RenderingCancelledException')
        fail('invalid');
      return;
    }
    if (viewer && event.pageNumber === viewer.currentPageNumber) {
      state = { ...state, rendered: true };
      publish();
      if (!ready && opening) {
        ready = true;
        post({ kind: 'ready', nonce: opening.nonce, state });
      }
    }
  });
  bus.on('updatefindcontrolstate', (value: unknown) => {
    const e = value as {
      state?: number;
      rawQuery?: string;
      matchesCount?: { current: number; total: number };
    };
    if (e.rawQuery !== undefined && e.rawQuery !== searchQuery) return;
    state = {
      ...state,
      searchPending: e.state === ui?.FindState.PENDING,
      ...(e.matchesCount
        ? { matchesCurrent: e.matchesCount.current, matchesTotal: e.matchesCount.total }
        : {}),
    };
    publish();
  });
  bus.on('updatefindmatchescount', (value: unknown) => {
    const e = value as { matchesCount: { current: number; total: number } };
    state = {
      ...state,
      searchPending: false,
      matchesCurrent: e.matchesCount.current,
      matchesTotal: e.matchesCount.total,
    };
    publish();
  });
  bus.on('editingstateschanged', (value: unknown) => {
    const e = value as { details: { hasSomethingToUndo: boolean; hasSomethingToRedo: boolean } };
    state = { ...state, undo: e.details.hasSomethingToUndo, redo: e.details.hasSomethingToRedo };
    syncModified();
    publish();
  });
  bus.on('annotationeditormodechanged', (value: unknown) => {
    const e = value as { mode: number };
    const mode: PdfEditorMode =
      e.mode === core?.AnnotationEditorType.FREETEXT
        ? 'text'
        : e.mode === core?.AnnotationEditorType.HIGHLIGHT
          ? 'highlight'
          : e.mode === core?.AnnotationEditorType.INK
            ? 'ink'
            : 'none';
    if (mode === 'none') uncommittedText = false;
    state = { ...state, editor: mode };
    syncModified();
    publish();
  });
  loading = core.getDocument({
    data: new Uint8Array(message.bytes),
    worker: sdkWorker,
    cMapUrl: new URL('cmaps/', assets).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('standard_fonts/', assets).href,
    wasmUrl: new URL('wasm/', assets).href,
    iccUrl: new URL('iccs/', assets).href,
    enableXfa: false,
    maxImageSize: message.limits.maxImagePixels,
    canvasMaxAreaInBytes: message.limits.maxCanvasPixels * 4,
    disableAutoFetch: true,
    disableStream: true,
    verbosity: core.VerbosityLevel.ERRORS,
  });
  loading.onPassword = (update: (password: string) => void, reason: number) => {
    passwordUpdater = update;
    if (opening)
      post({
        kind: 'password',
        nonce: opening.nonce,
        incorrect: reason === core?.PasswordResponses.INCORRECT_PASSWORD,
      });
  };
  doc = await loading.promise;
  if (closed) {
    await loading.destroy();
    return;
  }
  if (doc.numPages > message.limits.maxPages) {
    fail('limit');
    await dispose(message.id);
    return;
  }
  exportedHash = doc.annotationStorage.serializable.hash;
  // 上游声明将可写回调推断为null；本地只收敛该公开回调的实际类型。
  (doc.annotationStorage as unknown as { onSetModified: (() => void) | null }).onSetModified =
    () => {
      syncModified();
      publish();
    };
  viewer.setDocument(doc);
  links.setDocument(doc);
}
async function outline(): Promise<readonly PdfOutline[]> {
  if (!doc || !opening) throw new Error('PDF not open');
  const raw = await doc.getOutline();
  destinations.clear();
  let count = 0;
  type Node = { title: string; dest: unknown; items: Node[] };
  const visit = (items: readonly Node[], depth: number): PdfOutline[] => {
    if (items.length > 0 && depth > opening!.limits.maxOutlineDepth)
      throw new RangeError('outline limit');
    return items.map((item) => {
      if (++count > opening!.limits.maxOutlineEntries) throw new RangeError('outline limit');
      if (item.title.length > pdfOutlineTitleMaxLength) throw new RangeError('outline title limit');
      const id = String(count);
      if (item.dest) destinations.set(id, item.dest);
      return {
        id,
        title: item.title,
        navigable: Boolean(item.dest),
        items: visit(item.items ?? [], depth + 1),
      };
    });
  };
  return visit(raw ?? [], 1);
}
async function command(request: PdfRequest) {
  if (!opening || !viewer || !doc || !core || !bus || !links || closed) return;
  const result = (
    extra: Partial<Extract<PdfEvent, { kind: 'result' }>> = {},
    transfer: Transferable[] = [],
  ) => post({ kind: 'result', nonce: opening!.nonce, id: request.id, ...extra }, transfer);
  switch (request.kind) {
    case 'destroy':
      await dispose(request.id);
      return;
    case 'page':
      if (request.page > doc.numPages) throw new RangeError('page limit');
      remember();
      state = { ...state, rendered: false };
      viewer.currentPageNumber = request.page;
      await nextPaint();
      remember();
      break;
    case 'scale':
      state = { ...state, rendered: false };
      if (typeof request.scale === 'number')
        viewer.currentScale = Math.max(pdfMinScale, Math.min(pdfMaxScale, request.scale));
      else viewer.currentScaleValue = request.scale;
      break;
    case 'rotate':
      state = { ...state, rendered: false };
      viewer.pagesRotation = (viewer.pagesRotation + request.direction * 90 + 360) % 360;
      break;
    case 'find':
      searchQuery = request.query;
      state = {
        ...state,
        searchPending: Boolean(request.query),
        matchesCurrent: 0,
        matchesTotal: 0,
      };
      if (!request.query) {
        bus.dispatch('findbarclose', { source: viewer });
        break;
      }
      bus.dispatch('find', {
        source: viewer,
        type: request.again ? 'again' : '',
        query: request.query,
        caseSensitive: request.caseSensitive,
        entireWord: request.wholeWord,
        highlightAll: true,
        findPrevious: request.previous,
      });
      break;
    case 'outline':
      result({ outline: await outline() });
      return;
    case 'destination': {
      const destination = destinations.get(request.destinationId);
      if (typeof destination !== 'string' && !Array.isArray(destination))
        throw new Error('PDF destination unavailable');
      await links.goToDestination(destination);
      break;
    }
    case 'history': {
      const index = navigationIndex + request.direction;
      if (index < 0 || index >= navigation.length) throw new RangeError('history boundary');
      navigationIndex = index;
      navigatingHistory = true;
      try {
        const position = navigation[index]!;
        viewer.currentScale = position.scale;
        viewer.currentPageNumber = position.page;
        await nextPaint();
        viewer.container.scrollTo({ top: position.top, left: position.left, behavior: 'instant' });
      } finally {
        navigatingHistory = false;
      }
      break;
    }
    case 'thumbnail': {
      if (thumbnailBusy) throw new Error('PDF thumbnail busy');
      if (request.page > doc.numPages) throw new RangeError('page limit');
      thumbnailBusy = true;
      const canvas = document.createElement('canvas');
      try {
        const page = await doc.getPage(request.page);
        const initial = page.getViewport({ scale: 1, rotation: viewer.pagesRotation });
        const scale = Math.min(
          1,
          Math.sqrt(opening.limits.maxThumbnailPixels / (initial.width * initial.height)),
        );
        const viewport = page.getViewport({ scale, rotation: viewer.pagesRotation });
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        thumbnailTask = page.render({ canvas, viewport });
        await thumbnailTask.promise;
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) => (value ? resolve(value) : reject(new Error('PDF thumbnail encoding'))),
            'image/png',
          ),
        );
        if (blob.size > opening.limits.maxThumbnailBytes) throw new RangeError('thumbnail limit');
        const bytes = await blob.arrayBuffer();
        canvas.width = 0;
        canvas.height = 0;
        result({ bytes, page: request.page }, [bytes]);
      } finally {
        canvas.width = 0;
        canvas.height = 0;
        thumbnailBusy = false;
        thumbnailTask = undefined;
      }
      return;
    }
    case 'editor': {
      const modes = {
        none: core.AnnotationEditorType.NONE,
        text: core.AnnotationEditorType.FREETEXT,
        highlight: core.AnnotationEditorType.HIGHLIGHT,
        ink: core.AnnotationEditorType.INK,
      };
      await selectEditorMode(modes[request.mode]);
      break;
    }
    case 'edit':
      bus.dispatch('editingaction', { source: viewer, name: request.action });
      syncModified();
      break;
    case 'exported':
      if (pendingExportHash === undefined) throw new Error('PDF export not prepared');
      exportedHash = pendingExportHash;
      uncommittedText = false;
      pendingExportHash = undefined;
      doc.annotationStorage.resetModified();
      syncModified();
      break;
    case 'save': {
      await selectEditorMode(core.AnnotationEditorType.NONE);
      pendingExportHash = undefined;
      const savedHash = doc.annotationStorage.serializable.hash;
      const output = await doc.saveDocument();
      if (output.byteLength > opening.limits.maxBytes) throw new RangeError('PDF output limit');
      pendingExportHash = savedHash;
      const bytes = new Uint8Array(output).buffer;
      result({ bytes }, [bytes]);
      return;
    }
  }
  publish();
  result();
}
window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (event.source !== parent || event.origin !== location.origin || closed) return;
  const value = event.data;
  if (isPdfOpen(value)) {
    void open(value).catch(() => fail('invalid', value.id));
    return;
  }
  if (!opening || typeof value !== 'object' || value === null) return;
  const candidate = value as { nonce?: unknown; kind?: unknown; value?: unknown; id?: unknown };
  if (candidate.nonce !== opening.nonce) return;
  if (candidate.kind === 'theme' && (candidate.value === 'light' || candidate.value === 'dark')) {
    document.documentElement.style.colorScheme = candidate.value;
    return;
  }
  if (
    candidate.kind === 'password' &&
    typeof candidate.value === 'string' &&
    candidate.value.length <= pdfPasswordMaxLength
  ) {
    passwordUpdater?.(candidate.value);
    passwordUpdater = undefined;
    return;
  }
  if (!isPdfCommand(value)) return;
  if (value.kind === 'destroy') {
    void dispose(value.id);
    return;
  }
  void command(value).catch((error) =>
    fail(error instanceof RangeError ? 'limit' : 'unavailable', value.id),
  );
});
// input只保守保护正在输入、尚未提交的文字；提交/撤销后的准确状态由SDK摘要重新计算。
window.addEventListener('input', (event) => {
  if (ready && !closed && event.target instanceof HTMLElement && event.target.isContentEditable) {
    uncommittedText = true;
    state = { ...state, modified: true };
    publish();
  }
});
window.addEventListener('pointerup', scheduleModified);
window.addEventListener('keyup', scheduleModified);
window.addEventListener('keydown', (event) => {
  if (!event.defaultPrevented && event.key === 'Escape' && opening) {
    event.preventDefault();
    post({ kind: 'close-request', nonce: opening.nonce });
  }
});
window.addEventListener('resize', () => {
  if (viewer) {
    const mode = viewer.currentScaleValue;
    if (['page-fit', 'page-width'].includes(mode)) viewer.currentScaleValue = mode;
  }
});
window.addEventListener('pagehide', () => {
  frameLifetime.abort();
  cancelEditorChange();
  worker?.terminate();
  closed = true;
});
parent.postMessage(
  { kind: 'boot', version: pdfProtocolVersion } satisfies PdfEvent,
  location.origin,
);

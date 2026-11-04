import { FilesError, type PDFReaderLimits } from '@clouddrive/surface/files';
import assets from './assets.json';
import {
  isPdfReaderState,
  pdfProtocolVersion,
  pdfOutlineTitleMaxLength,
  type PdfCommand,
  type PdfEvent,
  type PdfReaderState,
  type PdfOutline,
  type PdfFailure,
} from './protocol';

export class PDFFrameError extends Error {
  constructor(
    public readonly code: PdfFailure,
    options?: ErrorOptions,
  ) {
    super('PDF frame: ' + code, options);
    this.name = 'PDFFrameError';
  }
}
type Result = Extract<PdfEvent, { kind: 'result' }>;
type Callbacks = {
  state: (state: PdfReaderState) => void;
  ready: () => void;
  password: (incorrect: boolean) => void;
  error: (error: Error) => void;
  close: () => void;
};
const closeGraceMs = 1000;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const errorCodes = new Set(['invalid', 'limit', 'worker', 'timeout', 'unavailable']);
/** PDFFrameSession 只拥有一个frame会话，source/origin/nonce围栏拒绝跨窗口或迟到消息。 */
export class PDFFrameSession {
  private readonly nonce = crypto.randomUUID();
  private next = 0;
  private closed = false;
  private openSent = false;
  private ready = false;
  private workPending = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private bootResolver: (() => void) | undefined;
  private closeResolver: (() => void) | undefined;
  private readonly pending = new Map<
    number,
    {
      resolve: (value: Result) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(
    private readonly frame: HTMLIFrameElement,
    private readonly limits: PDFReaderLimits,
    private readonly callbacks: Callbacks,
  ) {
    window.addEventListener('message', this.receive);
  }
  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
  private deadline(ms: number) {
    this.clearTimer();
    this.timer = setTimeout(() => this.fail(new PDFFrameError('timeout')), ms);
  }
  private fail(error: Error) {
    if (this.closed) return;
    this.callbacks.error(error);
    this.forceClose();
  }
  private receive = (event: MessageEvent<unknown>) => {
    if (
      this.closed ||
      event.source !== this.frame.contentWindow ||
      event.origin !== location.origin ||
      !record(event.data)
    )
      return;
    const value = event.data;
    if (value.kind === 'boot' && value.version === pdfProtocolVersion) {
      this.bootResolver?.();
      this.bootResolver = undefined;
      return;
    }
    if (value.nonce !== this.nonce) return;
    switch (value.kind) {
      case 'worker-ready':
        this.deadline(this.limits.workTimeoutMs);
        return;
      case 'password':
        if (typeof value.incorrect === 'boolean') {
          this.clearTimer();
          this.callbacks.password(value.incorrect);
        }
        return;
      case 'ready':
      case 'state':
        if (
          isPdfReaderState(value.state) &&
          value.state.pages <= this.limits.maxPages &&
          value.state.page <= value.state.pages
        ) {
          this.callbacks.state(value.state);
          if (this.ready) {
            const pending = value.state.searchPending || !value.state.rendered;
            if (pending && !this.workPending) this.deadline(this.limits.workTimeoutMs);
            if (!pending) this.clearTimer();
            this.workPending = pending;
          }
          if (value.kind === 'ready') {
            this.ready = true;
            this.workPending = false;
            this.clearTimer();
            this.callbacks.ready();
          }
        }
        return;
      case 'error': {
        if (typeof value.code !== 'string' || !errorCodes.has(value.code)) return;
        const error = new PDFFrameError(value.code as PdfFailure);
        if (typeof value.id === 'number' && this.pending.has(value.id)) {
          const pending = this.pending.get(value.id)!;
          clearTimeout(pending.timer);
          this.pending.delete(value.id);
          pending.reject(error);
        } else this.fail(error);
        return;
      }
      case 'result': {
        if (typeof value.id !== 'number') return;
        const pending = this.pending.get(value.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(value.id);
        pending.resolve(value as Result);
        return;
      }
      case 'closed':
        this.closeResolver?.();
        return;
      case 'close-request':
        this.callbacks.close();
        return;
    }
  };
  async open(bytes: ArrayBuffer, locale: string, theme: 'light' | 'dark') {
    if (this.closed || this.openSent) throw new FilesError('canceled');
    this.openSent = true;
    const boot = new Promise<void>((resolve) => {
      this.bootResolver = resolve;
    });
    this.deadline(this.limits.workerReadyTimeoutMs);
    this.frame.src = assets.publicPath + '/index.html';
    await boot;
    if (this.closed) return;
    this.deadline(this.limits.workerReadyTimeoutMs);
    this.frame.contentWindow?.postMessage(
      {
        kind: 'open',
        nonce: this.nonce,
        id: ++this.next,
        bytes,
        limits: this.limits,
        locale,
        theme,
      },
      location.origin,
      [bytes],
    );
  }
  theme(value: 'light' | 'dark') {
    if (!this.closed)
      this.frame.contentWindow?.postMessage(
        { kind: 'theme', nonce: this.nonce, value },
        location.origin,
      );
  }
  password(value: string) {
    if (this.closed) return;
    this.deadline(this.limits.workTimeoutMs);
    this.frame.contentWindow?.postMessage(
      { kind: 'password', nonce: this.nonce, value },
      location.origin,
    );
  }
  async command(command: PdfCommand): Promise<Result> {
    if (this.closed || !this.ready) throw new FilesError('canceled');
    const id = ++this.next;
    return new Promise<Result>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const error = new PDFFrameError('timeout');
        reject(error);
        this.fail(error);
      }, this.limits.workTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.frame.contentWindow?.postMessage(
          { ...command, nonce: this.nonce, id },
          location.origin,
        );
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new PDFFrameError('unavailable', { cause: error }));
      }
    });
  }
  async dispose() {
    if (this.closed) return;
    const completion = new Promise<void>((resolve) => {
      this.closeResolver = resolve;
    });
    try {
      this.frame.contentWindow?.postMessage(
        { kind: 'destroy', nonce: this.nonce, id: ++this.next },
        location.origin,
      );
    } catch {
      this.forceClose();
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      completion,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, closeGraceMs);
      }),
    ]);
    if (timer) clearTimeout(timer);
    this.forceClose();
  }
  forceClose() {
    if (this.closed) return;
    this.closed = true;
    this.clearTimer();
    this.bootResolver?.();
    this.bootResolver = undefined;
    this.closeResolver?.();
    this.closeResolver = undefined;
    window.removeEventListener('message', this.receive);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new FilesError('canceled'));
    }
    this.pending.clear();
    this.frame.src = 'about:blank';
  }
}
/** checkedOutline 只接受本次有界的普通文字投影，不让SDK目的地对象穿过frame。 */
export function checkedOutline(value: unknown, limits: PDFReaderLimits): readonly PdfOutline[] {
  let count = 0;
  const visit = (items: unknown, depth: number): PdfOutline[] => {
    if (!Array.isArray(items) || (items.length > 0 && depth > limits.maxOutlineDepth))
      throw new PDFFrameError('limit');
    return items.map((item: unknown) => {
      if (
        !record(item) ||
        typeof item.id !== 'string' ||
        typeof item.title !== 'string' ||
        typeof item.navigable !== 'boolean' ||
        item.title.length > pdfOutlineTitleMaxLength ||
        ++count > limits.maxOutlineEntries
      )
        throw new PDFFrameError('limit');
      return {
        id: item.id,
        title: item.title,
        navigable: item.navigable,
        items: visit(item.items, depth + 1),
      };
    });
  };
  return visit(value, 1);
}

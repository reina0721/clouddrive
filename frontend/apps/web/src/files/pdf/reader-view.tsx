'use client';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { FilesError, type FileDocumentProps } from '@clouddrive/surface/files';
import { Action } from '@clouddrive/ui-adapter/action';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { FileChoiceAction } from '@clouddrive/ui-adapter/file-choice-action';
import { MenuButton } from '@clouddrive/ui-adapter/menu-button';
import { CheckboxField, PasswordField, TextField } from '@clouddrive/ui-adapter/form-field';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Undo2,
  Redo2,
  Search,
  X,
} from 'lucide-react';
import { downloadBlob } from '../native-download';
import { imageOverlayLimit, imageOverlayTypes } from '../image-overlay';
import { useImageOverlayImport } from '../use-image-overlay-import';
import { PDFFrameSession, PDFFrameError, checkedOutline } from './session';
import {
  emptyPdfState,
  pdfSearchMaxLength,
  pdfThumbnailPageSize,
  pdfPasswordMaxLength,
  pdfMinScale,
  pdfMaxScale,
  pdfStampLimits,
  type PdfCommand,
  type PdfOutline,
} from './protocol';

type Props = FileDocumentProps & {
  readContent: (props: FileDocumentProps, signal: AbortSignal) => Promise<ArrayBuffer>;
};
const readerModes = ['none', 'text', 'highlight', 'ink'] as const;
const currentTheme = (): 'light' | 'dark' => {
  const theme = document.documentElement.dataset.theme;
  if (theme === 'light' || theme === 'dark') return theme;
  throw new PDFFrameError('unavailable');
};
/** PDFReaderView 拥有阅读会话、用户意图和所有临时URL，不把SDK类型交给Surface。 */
export function PDFReaderView(props: Props) {
  const {
    entry,
    limits: suppliedLimits,
    version,
    readContent,
    onClose,
    closeRequestSequence,
  } = props;
  // 会话预算固定在打开时，后台列表返回同值新对象不能重开frame、丢弃临时批注。
  const [limits] = useState(() => ({ ...suppliedLimits }));
  const { t, locale } = useFrontendTranslation();
  const p = useCallback(
    (key: string, values?: Record<string, string | number>) => t('files.pdf.' + key, values ?? {}),
    [t],
  );
  const [phase, setPhase] = useState<'loading' | 'password' | 'ready' | 'error'>('loading');
  const [state, setState] = useState({ ...emptyPdfState });
  const stampImport = useImageOverlayImport();
  const [failure, setFailure] = useState(''),
    [notice, setNotice] = useState(''),
    [attempt, setAttempt] = useState(0),
    [busy, setBusy] = useState(false);
  const [pageDraft, setPageDraft] = useState('1'),
    [password, setPassword] = useState(''),
    [incorrect, setIncorrect] = useState(false),
    [discard, setDiscard] = useState(false);
  const [panel, setPanel] = useState<'none' | 'thumbnails' | 'outline'>('none'),
    [outline, setOutline] = useState<readonly PdfOutline[]>(),
    [sideFailure, setSideFailure] = useState('');
  const [thumbnailPage, setThumbnailPage] = useState(1),
    [thumbnails, setThumbnails] = useState<readonly { page: number; url: string }[]>([]),
    [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false),
    [query, setQuery] = useState(''),
    [caseSensitive, setCaseSensitive] = useState(false),
    [wholeWord, setWholeWord] = useState(false);
  const [submitted, setSubmitted] = useState<{
    query: string;
    caseSensitive: boolean;
    wholeWord: boolean;
  }>();
  const searchId = useId();
  const searchInput = useRef<HTMLInputElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const frame = useRef<HTMLIFrameElement>(null),
    session = useRef<PDFFrameSession | null>(null);
  const activeState = useRef(state),
    operation = useRef(false),
    handledClose = useRef(closeRequestSequence),
    thumbnailTail = useRef(Promise.resolve());
  const labels = useRef({ p, t, locale });
  const closeCallback = useRef<() => void>(() => {});
  useEffect(() => {
    labels.current = { p, t, locale };
  }, [p, t, locale]);
  const errorText = useCallback((error: unknown) => {
    if (error instanceof PDFFrameError) return labels.current.p(error.code);
    if (error instanceof FilesError) {
      if (error.code === 'conflict') return labels.current.p('sourceConflict');
      if (error.code === 'large') return labels.current.p('limit');
      return labels.current.t('files.errors.' + error.code);
    }
    return labels.current.p('unavailable');
  }, []);
  const finishClose = useCallback(async () => {
    await session.current?.dispose();
    onClose();
  }, [onClose]);
  const requestClose = useCallback(() => {
    if (activeState.current.modified) setDiscard(true);
    else void finishClose();
  }, [finishClose]);
  useEffect(() => {
    closeCallback.current = requestClose;
  }, [requestClose]);
  useEffect(() => {
    if (handledClose.current !== closeRequestSequence) {
      handledClose.current = closeRequestSequence;
      closeCallback.current();
    }
  }, [closeRequestSequence]);
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const controller = new AbortController();
    let active = true;
    const owned = new PDFFrameSession(element, limits, {
      state: (value) => {
        if (!active) return;
        if (value.page !== activeState.current.page) setPageDraft(String(value.page));
        activeState.current = value;
        setState(value);
      },
      ready: () => {
        if (active) {
          setPhase('ready');
          setPassword('');
        }
      },
      password: (wrong) => {
        if (active) {
          setPhase('password');
          setIncorrect(wrong);
          setBusy(false);
          operation.current = false;
        }
      },
      error: (error) => {
        if (active) {
          setFailure(errorText(error));
          setPhase('error');
        }
      },
      close: () => closeCallback.current(),
    });
    session.current = owned;
    void readContent({ ...props, limits }, controller.signal)
      .then((bytes) => {
        if (active) return owned.open(bytes, labels.current.locale, currentTheme());
      })
      .catch((error) => {
        if (active && !controller.signal.aborted) {
          setFailure(errorText(error));
          setPhase('error');
          owned.forceClose();
        }
      });
    return () => {
      active = false;
      controller.abort();
      owned.forceClose();
      if (session.current === owned) session.current = null;
    };
    // 语言在打开时传入；切换界面语言不销毁尚未导出的标注。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entry.id,
    entry.contentRevision,
    entry.sizeBytes,
    version,
    limits,
    readContent,
    attempt,
    errorText,
  ]);
  useEffect(() => {
    const update = () => session.current?.theme(currentTheme());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    });
    return () => {
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    if (!state.modified) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.modified]);
  const act = useCallback(
    async (
      command: PdfCommand,
      consume?: (value: Awaited<ReturnType<PDFFrameSession['command']>>) => void | Promise<void>,
    ) => {
      if (operation.current || !session.current) return;
      operation.current = true;
      setBusy(true);
      setNotice('');
      setFailure('');
      try {
        const result = await session.current.command(command);
        await consume?.(result);
      } catch (error) {
        setFailure(errorText(error));
      } finally {
        operation.current = false;
        setBusy(false);
      }
    },
    [errorText],
  );
  useEffect(() => {
    if (panel !== 'outline' || phase !== 'ready' || !session.current) return;
    const owned = session.current;
    let active = true;
    void owned
      .command({ kind: 'outline' })
      .then((value) => {
        if (active) setOutline(checkedOutline(value.outline, limits));
      })
      .catch((error) => {
        if (active) setSideFailure(errorText(error));
      });
    return () => {
      active = false;
    };
  }, [panel, phase, limits, errorText]);
  useEffect(() => {
    if (panel !== 'thumbnails' || phase !== 'ready' || !session.current) return;
    const owned = session.current,
      controller = new AbortController(),
      urls: string[] = [];
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setThumbnails([]);
        setThumbnailLoading(true);
      }
    });
    const previous = thumbnailTail.current;
    const task = previous
      .then(async () => {
        if (controller.signal.aborted) return;
        const start = (thumbnailPage - 1) * pdfThumbnailPageSize + 1;
        for (
          let page = start;
          page <= Math.min(state.pages, start + pdfThumbnailPageSize - 1);
          page++
        ) {
          if (controller.signal.aborted) return;
          const result = await owned.command({ kind: 'thumbnail', page });
          if (controller.signal.aborted) return;
          if (
            !(result.bytes instanceof ArrayBuffer) ||
            result.page !== page ||
            result.bytes.byteLength > limits.maxThumbnailBytes
          )
            throw new PDFFrameError('limit');
          const url = URL.createObjectURL(new Blob([result.bytes], { type: 'image/png' }));
          urls.push(url);
          setThumbnails((current) => [...current, { page, url }]);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setSideFailure(errorText(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setThumbnailLoading(false);
      });
    thumbnailTail.current = task;
    return () => {
      controller.abort();
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [panel, phase, thumbnailPage, state.pages, state.rotation, limits, errorText]);
  const available = phase === 'ready' && !busy && !stampImport.loading && state.rendered;
  const stampLimitReached = state.stampCount >= pdfStampLimits.count;
  function chooseStamp(file: File) {
    const owned = session.current;
    if (!available || stampLimitReached || !owned) return;
    const targetPage = state.page;
    setFailure('');
    setNotice('');
    void stampImport.read(file, (bitmap, name, type) => {
      bitmap.close();
      if (session.current !== owned) return;
      void act({ kind: 'stamp', page: targetPage, file: new File([file], name, { type }) }, () =>
        setNotice(p('stampAdded', { page: targetPage })),
      );
    });
  }
  const displayItems = [
    ['first', state.page === 1],
    ['last', state.page === state.pages],
    ['zoomIn', state.scale >= pdfMaxScale],
    ['zoomOut', state.scale <= pdfMinScale],
    ['fitPage', false],
    ['fitWidth', false],
    ['actualSize', false],
    ['rotateLeft', false],
    ['rotateRight', false],
  ].map(([id, disabled]) => ({
    id: String(id),
    label: p(String(id)),
    disabled: !available || Boolean(disabled),
  }));
  const displayAction = (id: string) => {
    const commands: Record<string, PdfCommand> = {
      first: { kind: 'page', page: 1 },
      last: { kind: 'page', page: state.pages },
      zoomIn: { kind: 'scale', scale: Math.min(pdfMaxScale, state.scale * 1.25) },
      zoomOut: { kind: 'scale', scale: Math.max(pdfMinScale, state.scale / 1.25) },
      fitPage: { kind: 'scale', scale: 'page-fit' },
      fitWidth: { kind: 'scale', scale: 'page-width' },
      actualSize: { kind: 'scale', scale: 1 },
      rotateLeft: { kind: 'rotate', direction: -1 },
      rotateRight: { kind: 'rotate', direction: 1 },
    };
    const command = commands[id];
    if (command) void act(command);
  };
  const openPanel = (next: 'none' | 'thumbnails' | 'outline') => {
    setSideFailure('');
    setOutline(undefined);
    setThumbnails([]);
    setThumbnailPage(1);
    setPanel(next);
  };
  const find = (again = false, previous = false) => {
    if (state.searchPending) return;
    const value = again ? submitted : { query, caseSensitive, wholeWord };
    if (!value) return;
    setSubmitted(value);
    void act({ kind: 'find', ...value, again, previous });
  };
  const outlineNodes = (items: readonly PdfOutline[]): ReactNode => (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <Action
            size="sm"
            variant="quiet"
            disabled={!available || !item.navigable}
            onPress={() => {
              void act({ kind: 'destination', destinationId: item.id });
            }}
          >
            {item.title || p('outlineUntitled', { id: item.id })}
          </Action>
          {item.items.length ? <div className="pl-4">{outlineNodes(item.items)}</div> : null}
        </li>
      ))}
    </ul>
  );
  const searchCurrent =
    submitted?.query === query &&
    submitted.caseSensitive === caseSensitive &&
    submitted.wholeWord === wholeWord;
  return (
    <section aria-label={p('title')} className="flex h-full min-h-0 min-w-0 flex-col gap-2">
      <div className="shrink-0 overflow-x-auto">
        <div
          className="flex items-center gap-2"
          style={{ minWidth: 'max-content' }}
          role="toolbar"
          aria-label={p('title')}
        >
          <IconAction
            label={p('previous')}
            tooltip
            size="sm"
            disabled={!available || state.page <= 1}
            onPress={() => {
              void act({ kind: 'page', page: state.page - 1 });
            }}
          >
            <ChevronLeft className="size-icon-sm" aria-hidden="true" />
          </IconAction>
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const page = Number(pageDraft);
              if (
                !/^\d+$/.test(pageDraft) ||
                !Number.isSafeInteger(page) ||
                page < 1 ||
                page > state.pages
              ) {
                setFailure(p('invalidPage'));
                return;
              }
              void act({ kind: 'page', page });
            }}
          >
            <div className="w-16">
              <TextField
                label={p('page')}
                presentation="control-only"
                inputMode="numeric"
                value={pageDraft}
                disabled={phase !== 'ready'}
                onChange={(event) => setPageDraft(event.target.value.slice(0, 12))}
              />
            </div>
            <Action size="sm" type="submit" variant="secondary" disabled={!available}>
              {p('go')}
            </Action>
          </form>
          <IconAction
            label={p('next')}
            tooltip
            size="sm"
            disabled={!available || state.page >= state.pages}
            onPress={() => {
              void act({ kind: 'page', page: state.page + 1 });
            }}
          >
            <ChevronRight className="size-icon-sm" aria-hidden="true" />
          </IconAction>
          <MenuButton
            triggerSize="sm"
            label={Math.round(state.scale * 100) + '%'}
            ariaLabel={p('display')}
            items={displayItems}
            onAction={displayAction}
          />
          <MenuButton
            triggerSize="sm"
            label={p('navigation')}
            ariaLabel={p('navigation')}
            items={['thumbnails', 'outline', 'hidePanel'].map((id) => ({
              id,
              label: p(id),
              disabled: phase !== 'ready',
            }))}
            onAction={(id) =>
              openPanel(id === 'thumbnails' ? 'thumbnails' : id === 'outline' ? 'outline' : 'none')
            }
          />
          <IconAction
            ref={searchTrigger}
            size="sm"
            label={p('search')}
            disabled={!available}
            controls={searchId}
            expanded={searchOpen}
            active={searchOpen}
            tooltip
            onPress={() => setSearchOpen((value) => !value)}
          >
            <Search className="size-icon-sm" aria-hidden="true" />
          </IconAction>
          <IconAction
            label={p('back')}
            tooltip
            size="sm"
            disabled={!available || !state.historyBack}
            onPress={() => {
              void act({ kind: 'history', direction: -1 });
            }}
          >
            <ArrowLeft className="size-icon-sm" aria-hidden="true" />
          </IconAction>
          <IconAction
            label={p('forward')}
            tooltip
            size="sm"
            disabled={!available || !state.historyForward}
            onPress={() => {
              void act({ kind: 'history', direction: 1 });
            }}
          >
            <ArrowRight className="size-icon-sm" aria-hidden="true" />
          </IconAction>
          <MenuButton
            triggerSize="sm"
            label={p('editor')}
            ariaLabel={p('editor')}
            items={readerModes.map((id) => ({
              id,
              label: p(id),
              disabled: !available,
            }))}
            onAction={(id) => {
              const mode = readerModes.find((item) => item === id);
              if (mode) void act({ kind: 'editor', mode });
            }}
          />
          <FileChoiceAction
            acceptedTypes={imageOverlayTypes}
            disabled={!available || stampLimitReached}
            onSelect={chooseStamp}
          >
            {p('stamp')}
          </FileChoiceAction>
          <IconAction
            label={p('undo')}
            tooltip
            size="sm"
            disabled={!available || !state.undo}
            onPress={() => {
              void act({ kind: 'edit', action: 'undo' });
            }}
          >
            <Undo2 className="size-icon-sm" aria-hidden="true" />
          </IconAction>
          <IconAction
            label={p('redo')}
            tooltip
            size="sm"
            disabled={!available || !state.redo}
            onPress={() => {
              void act({ kind: 'edit', action: 'redo' });
            }}
          >
            <Redo2 className="size-icon-sm" aria-hidden="true" />
          </IconAction>
          <Action
            size="sm"
            variant={state.modified ? 'primary' : 'quiet'}
            disabled={!available || !state.modified}
            onPress={() => {
              void act({ kind: 'save' }, async (value) => {
                if (
                  !(value.bytes instanceof ArrayBuffer) ||
                  value.bytes.byteLength > limits.maxBytes ||
                  new TextDecoder().decode(value.bytes.slice(0, 5)) !== '%PDF-'
                )
                  throw new PDFFrameError('invalid');
                downloadBlob(
                  new Blob([value.bytes], { type: 'application/pdf' }),
                  entry.name.replace(/\.pdf$/i, '') + '.' + p('exportName') + '.pdf',
                );
                await session.current?.command({ kind: 'exported' });
                setNotice(p('exported'));
              });
            }}
          >
            {p('export')}
          </Action>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs" role="status">
        <span>{p('pageCount', { page: state.page, pages: state.pages })}</span>
        <span className="text-ink-muted">
          {p('imageBudget', { pixels: limits.maxImagePixels.toLocaleString(locale) })}
        </span>
        {state.modified ? <span>{p('modified')}</span> : null}
        {busy ? <span>{p('working')}</span> : null}
      </div>
      {stampImport.loading ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="status">{p('stampReading')}</p>
          <Action size="sm" variant="quiet" onPress={stampImport.cancel}>
            {p('stampCancel')}
          </Action>
        </div>
      ) : null}
      {stampImport.error ? (
        <p role="alert">
          {p(stampImport.error, {
            mebibytes: imageOverlayLimit.mebibytes,
            pixels: imageOverlayLimit.sidePixels,
          })}
        </p>
      ) : null}
      {stampLimitReached ? (
        <p role="status">{p('stampLimit', { count: pdfStampLimits.count })}</p>
      ) : null}
      {phase === 'loading' ? <p role="status">{p('loading')}</p> : null}
      {phase === 'password' ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setPhase('loading');
            session.current?.password(password);
            setPassword('');
          }}
        >
          <p>{p(incorrect ? 'passwordIncorrect' : 'passwordNeeded')}</p>
          <PasswordField
            purpose="transient"
            label={p('password')}
            showLabel={p('showPassword')}
            hideLabel={p('hidePassword')}
            value={password}
            onChange={(event) => setPassword(event.target.value.slice(0, pdfPasswordMaxLength))}
          />
          <Action type="submit" disabled={!password}>
            {p('unlock')}
          </Action>
        </form>
      ) : null}
      {failure ? <p role="alert">{failure}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {phase === 'error' ? (
        <Action
          variant="secondary"
          onPress={() => {
            setFailure('');
            setPhase('loading');
            setState({ ...emptyPdfState });
            activeState.current = { ...emptyPdfState };
            setPanel('none');
            setAttempt((value) => value + 1);
          }}
        >
          {p('retry')}
        </Action>
      ) : null}
      {searchOpen && phase === 'ready' ? (
        <form
          id={searchId}
          role="search"
          aria-label={p('query')}
          className="flex shrink-0 flex-col gap-1 rounded-panel bg-surface-muted p-2 md:flex-row md:items-center"
          onKeyDownCapture={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            setSearchOpen(false);
            searchTrigger.current?.focus();
          }}
          onSubmit={(event) => {
            event.preventDefault();
            find();
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <SearchBox
              inputRef={searchInput}
              label={p('query')}
              placeholder={p('query')}
              value={query}
              onValueChange={(value) => setQuery(value.slice(0, pdfSearchMaxLength))}
            />
            <Action size="sm" type="submit" disabled={busy || state.searchPending}>
              {p('find')}
            </Action>
            <IconAction
              size="sm"
              label={p('previousMatch')}
              tooltip
              disabled={!searchCurrent || state.searchPending || !state.matchesTotal}
              onPress={() => find(true, true)}
            >
              <ChevronLeft className="size-icon-sm" aria-hidden="true" />
            </IconAction>
            <IconAction
              size="sm"
              label={p('nextMatch')}
              tooltip
              disabled={!searchCurrent || state.searchPending || !state.matchesTotal}
              onPress={() => find(true, false)}
            >
              <ChevronRight className="size-icon-sm" aria-hidden="true" />
            </IconAction>
            <IconAction
              size="sm"
              label={p('clearSearch')}
              tooltip
              disabled={state.searchPending}
              onPress={() => {
                setQuery('');
                setSubmitted(undefined);
                void act({
                  kind: 'find',
                  query: '',
                  caseSensitive: false,
                  wholeWord: false,
                  previous: false,
                  again: false,
                });
              }}
            >
              <X className="size-icon-sm" aria-hidden="true" />
            </IconAction>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">
            <div className="shrink-0">
              <CheckboxField
                label={p('caseSensitive')}
                checked={caseSensitive}
                onCheckedChange={setCaseSensitive}
              />
            </div>
            <div className="shrink-0">
              <CheckboxField
                label={p('wholeWord')}
                checked={wholeWord}
                onCheckedChange={setWholeWord}
              />
            </div>
            <p
              role="status"
              className={submitted || state.searchPending ? 'text-xs text-ink-muted' : 'sr-only'}
            >
              {state.searchPending
                ? p('searching')
                : submitted
                  ? p('matches', { current: state.matchesCurrent, total: state.matchesTotal })
                  : p('queryHint')}
            </p>
          </div>
        </form>
      ) : null}
      <div className="relative flex min-h-0 flex-1 gap-2">
        {panel !== 'none' ? (
          <aside
            className="absolute inset-y-0 left-0 z-10 w-60 max-w-full overflow-y-auto space-y-2 rounded-panel border border-border bg-surface-raised p-3 shadow-overlay md:static md:shrink-0 md:shadow-none"
            aria-label={p(panel)}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{p(panel)}</h3>
              <IconAction
                label={p('hidePanel')}
                size="sm"
                tooltip
                onPress={() => openPanel('none')}
              >
                <X className="size-icon-sm" aria-hidden="true" />
              </IconAction>
            </div>
            {sideFailure ? <p role="alert">{sideFailure}</p> : null}
            {panel === 'outline' ? (
              outline ? (
                outline.length ? (
                  outlineNodes(outline)
                ) : (
                  <p>{p('noOutline')}</p>
                )
              ) : (
                <p role="status">{p('outlineLoading')}</p>
              )
            ) : (
              <>
                <div className="flex gap-2">
                  <Action
                    size="sm"
                    variant="quiet"
                    disabled={thumbnailPage <= 1 || thumbnailLoading}
                    onPress={() => {
                      setThumbnails([]);
                      setThumbnailPage((value) => value - 1);
                    }}
                  >
                    {p('previousGroup')}
                  </Action>
                  <Action
                    size="sm"
                    variant="quiet"
                    disabled={
                      thumbnailPage * pdfThumbnailPageSize >= state.pages || thumbnailLoading
                    }
                    onPress={() => {
                      setThumbnails([]);
                      setThumbnailPage((value) => value + 1);
                    }}
                  >
                    {p('nextGroup')}
                  </Action>
                </div>
                {thumbnailLoading ? <p role="status">{p('thumbnailLoading')}</p> : null}
                <ul className="space-y-2">
                  {thumbnails.map((item) => (
                    <li key={item.page}>
                      <Action
                        size="sm"
                        variant="quiet"
                        disabled={!available}
                        onPress={() => {
                          void act({ kind: 'page', page: item.page });
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <img
                            src={item.url}
                            alt=""
                            className="max-h-24 max-w-full object-contain"
                          />
                          <span>{p('thumbnailPage', { page: item.page })}</span>
                        </span>
                      </Action>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        ) : null}
        <iframe
          key={attempt}
          ref={frame}
          inert={busy || stampImport.loading}
          data-pdf-editor={state.editor}
          title={p('frame')}
          sandbox="allow-scripts allow-same-origin"
          className="min-h-0 w-full flex-1 rounded-control border border-border"
        />
      </div>
      {discard ? (
        <DialogSurface
          isOpen
          triggerLabel={p('discardTitle')}
          title={p('discardTitle')}
          description={p('discardHint')}
          cancelLabel={p('keepReading')}
          confirmLabel={p('discard')}
          onOpenChange={(open) => {
            if (!open) setDiscard(false);
          }}
          onConfirm={finishClose}
        >
          <p>{p('modified')}</p>
        </DialogSurface>
      ) : null}
    </section>
  );
}

'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField, TextField } from '@clouddrive/ui-adapter/form-field';
import { MenuButton } from '@clouddrive/ui-adapter/menu-button';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { FileAnnotationSummary } from '../../../src/files/annotation-values';
import { isEpubDocument } from '../../../src/files/epub-contract';
import {
  fileApplicationChoice,
  fileApplicationName,
  isTextPreview,
  type FileApplicationID,
} from '../../../src/files/file-applications';
import { fileIconExtension, type FileIconRule } from '../../../src/files/icon-rules';
import { isMarkdownFile } from '../../../src/files/markdown';
import { fileClipboardMaxEntries, type FileClipboardMode } from '../../../src/files/clipboard';
import { formatFileBytes as bytes } from '../../../src/files/format';
import {
  ArrowUpDown,
  Cloud,
  Home,
  LayoutGrid,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Upload,
} from '../../../src/files/icons';
import {
  FilesError,
  type FileEntry,
  type FileListing,
  type FileQuery,
  type FileViewPreferences,
  type UploadCandidate,
} from '../../../src/files/model';
import { isPDFDocument } from '../../../src/files/pdf-contract';
import {
  changeFileView,
  resolveFileView,
  type FilePreferenceSnapshot,
} from '../../../src/files/preferences';
import type { PinTarget } from '../../../src/files/navigation';
import {
  FileMedia,
  useFileNavigation,
  useFiles,
  useTransfers,
  useTransferSnapshot,
} from '../../../src/files/runtime';
import { decodeFileFilters, encodeFileFilters, type FileFilters } from '../../../src/files/search';
import { fileSelectionRange, nextFileFocus } from '../../../src/files/selection';
import {
  defaultFileViewPreferences,
  fileViewPreferencesSchema,
} from '../../../src/files/view-options';
import { useWorkspaceCreate, useWorkspaceRevision } from '../stores/workspace';
import { ActiveFilterChips } from './active-filter-chips';
import { AdvancedSearchDialog } from './advanced-search-dialog';
import { AnnotationPanel } from './annotation-panel';
import { FileItem, FileListHeader, type FileSelectionGesture } from './file-item';
import { CursorFilePagination, NumberedFilePagination } from './file-pagination';
import { PinDialog } from './pinned-links';
import { ShareDialog } from './share-dialog';
import { directLinkBatchLimit } from '../../../src/files/direct-links';
import { SaveShortcutDialog, ShortcutActionDialog } from './shortcut-dialogs';
import { TagsBatchDialog } from './tags-batch-dialog';
import { TextDialog, type TextRequest } from './text-dialog';
import { VersionsPanel } from './versions-panel';
import { ViewOptionsDialog } from './view-options-dialog';
import { useCursorFileFeed } from './use-cursor-file-feed';
import type { TrashPurgeSelection } from '../../../src/files/trash-purge';

const TrashPurgeDialog = lazy(() => import('./trash-purge-dialog'));
const PdfDialog = lazy(() =>
  import('./pdf-dialog').then((module) => ({ default: module.PdfDialog })),
);
const EpubDialog = lazy(() =>
  import('./epub-dialog').then((module) => ({ default: module.EpubDialog })),
);
const ArchiveDialog = lazy(() =>
  import('./archive-dialog').then((module) => ({ default: module.ArchiveDialog })),
);
const ArchiveCreateDialog = lazy(() =>
  import('./archive-create-dialog').then((module) => ({ default: module.ArchiveCreateDialog })),
);
const DirectLinksDialog = lazy(() => import('./direct-links-dialog'));
const archiveFile = (entry: FileEntry) =>
  entry.kind === 'file' &&
  (/\.(zip|7z)$/i.test(entry.name) ||
    entry.mediaType === 'application/zip' ||
    entry.mediaType === 'application/x-7z-compressed');

const mobileFileApplicationWidth = 768;

function compatibleFileApplications(entry: FileEntry): FileApplicationID[] {
  if (archiveFile(entry)) return ['archive'];
  if (isPDFDocument(entry)) return ['pdf'];
  if (isEpubDocument(entry)) return ['epub'];
  if (isMarkdownFile(entry)) return ['markdown', 'text'];
  const media = entry.mediaType.split('/', 1)[0];
  if (media === 'image' || media === 'audio' || media === 'video') return [media];
  return isTextPreview(entry) ? ['text'] : [];
}

type FileApplicationPicker = Readonly<{
  entry: FileEntry;
  options?: readonly FileApplicationID[];
  error?: string;
}>;

type Props = Readonly<{
  parent: string;
  category: string;
  trash: boolean;
  search: string;
  filters: FileFilters;
  page: number;
  numbered: boolean;
  cursor: string;
  queryInvalid: boolean;
  navigate: (query: Record<string, string>) => void;
}>;
type Dialog = {
  mode: 'rename' | 'move' | 'copy' | 'remove' | 'restore';
  targets: FileEntry[];
};
const FileAccessDialog = lazy(() =>
  import('./access-dialog').then((module) => ({ default: module.FileAccessDialog })),
);
export function FilesPage({
  parent,
  category,
  trash,
  search,
  filters,
  page,
  numbered,
  cursor,
  queryInvalid,
  navigate: routeNavigate,
}: Props) {
  const filterKey = encodeFileFilters(filters);
  const port = useFiles();
  const navigation = useFileNavigation();
  const transfers = useTransfers();
  const transferState = useTransferSnapshot();
  const { t, locale } = useFrontendTranslation();
  const chinese = locale.startsWith('zh');
  const openWithLabel = chinese ? '打开方式' : 'Open with';
  const noApplicationLabel = chinese
    ? '此文件在当前设备上没有可用的浏览应用。'
    : 'No viewer is available for this file on this device.';
  const [listingSnapshot, setListingSnapshot] = useState<{
    query: FileQuery;
    revision: number;
    value: FileListing;
  }>();
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const navigate = useCallback(
    (query: Record<string, string>) => {
      if (
        (query.parent ?? '') !== parent ||
        (query.category ?? '') !== category ||
        (query.trash === 'true') !== trash ||
        (query.search ?? '') !== search ||
        (query.filter ?? '') !== filterKey ||
        Number(query.page ?? 1) !== page ||
        !!query.page !== numbered ||
        (query.cursor ?? '') !== cursor
      )
        setNavigating(true);
      routeNavigate(query);
    },
    [routeNavigate, parent, category, trash, search, filterKey, page, numbered, cursor],
  );
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useWorkspaceRevision();
  const [iconRules, setIconRules] = useState<readonly FileIconRule[]>([]);
  const [iconRulesUnavailable, setIconRulesUnavailable] = useState(false);
  const createInWorkspace = useWorkspaceCreate();
  const [saveShortcut, setSaveShortcut] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<FileEntry>();
  const [trashSelection, setTrashSelection] = useState<TrashPurgeSelection>();
  const [pinTarget, setPinTarget] = useState<PinTarget>();
  const [preferences, setPreferences] = useState(() =>
    fileViewPreferencesSchema.parse(defaultFileViewPreferences),
  );
  const preferenceParent = !category && !trash && !search && !filterKey ? parent : undefined;
  const preferenceScope = preferenceParent === undefined ? 'global' : 'folder:' + preferenceParent;
  const preferenceScopeRef = useRef(preferenceScope);
  preferenceScopeRef.current = preferenceScope;
  const [preferenceSnapshot, setPreferenceSnapshot] = useState<FilePreferenceSnapshot>(),
    [preferenceFailure, setPreferenceFailure] = useState(''),
    [preferenceBusy, setPreferenceBusy] = useState(false),
    [preferenceReload, setPreferenceReload] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false),
    [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [focusedEntry, setFocusedEntry] = useState(''),
    [selectionAnchor, setSelectionAnchor] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [dialog, setDialog] = useState<Dialog>();
  const [shareTarget, setShareTarget] = useState<FileEntry>();
  const [directTargets, setDirectTargets] = useState<readonly FileEntry[]>();
  const [accessTarget, setAccessTarget] = useState<FileEntry>();
  const [textRequest, setTextRequest] = useState<TextRequest>();
  const [pdfEntry, setPdfEntry] = useState<FileEntry>();
  const [epubEntry, setEpubEntry] = useState<FileEntry>();
  const [mediaEntry, setMediaEntry] = useState<FileEntry>();
  const videoPreview = mediaEntry?.mediaType.startsWith('video/');
  const [archiveEntry, setArchiveEntry] = useState<FileEntry>();
  const [zipSelection, setZIPSelection] = useState<{
    entries: readonly FileEntry[];
    parent: string;
  }>();
  const [queuedZIPName, setQueuedZIPName] = useState('');
  const [contextEntry, setContextEntry] = useState<string>();
  const [galleryPage, setGalleryPage] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const destinationDialogOpen =
    dialog?.mode === 'move' || dialog?.mode === 'restore' || dialog?.mode === 'copy';
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [folders, setFolders] = useState<FileListing>();
  const [dialogFailure, setDialogFailure] = useState('');
  const [detail, setDetail] = useState<FileEntry>();
  const [versionEntry, setVersionEntry] = useState<FileEntry>();
  const [tagsBatch, setTagsBatch] = useState<{
    mode: 'add' | 'remove';
    targets: FileAnnotationSummary[];
  }>();
  const [galleryAnnotations, setGalleryAnnotations] = useState<FileAnnotationSummary[]>([]),
    [galleryAnnotationsLoading, setGalleryAnnotationsLoading] = useState(false),
    [galleryAnnotationFailure, setGalleryAnnotationFailure] = useState('');
  const [preview, setPreview] = useState<{ entry: FileEntry; text: string; loading: boolean }>();
  const [applicationPicker, setApplicationPicker] = useState<FileApplicationPicker>();
  const previewController = useRef<AbortController | undefined>(undefined);
  const fileContent = useRef<HTMLElement>(null);
  const errorText = useCallback(
    (error: unknown) =>
      t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
    [t],
  );
  const reload = useCallback(() => setRevision((value) => value + 1), [setRevision]);
  const firstPage = () =>
    navigate({ parent, category, trash: trash ? 'true' : '', search, filter: filterKey });
  const preferenceReady = !!preferenceSnapshot || !!preferenceFailure;
  const cursorWaitingForPreferences = !!cursor && !preferenceReady;
  const listQuery = useMemo<FileQuery>(
    () => ({
      parent,
      category,
      trash,
      search,
      sort: preferences.sort,
      desc: preferences.desc,
      filters: decodeFileFilters(filterKey),
      foldersFirst: preferences.foldersFirst,
      page: preferences.view === 'gallery' ? 1 : page,
      pageSize: preferences.view === 'gallery' ? 0 : preferences.pageSize,
      ...(preferences.view !== 'gallery'
        ? { pagination: numbered ? ('numbered' as const) : ('auto' as const), cursor }
        : {}),
    }),
    [
      parent,
      category,
      trash,
      search,
      preferences.sort,
      preferences.desc,
      filterKey,
      preferences.foldersFirst,
      preferences.view,
      preferences.pageSize,
      page,
      numbered,
      cursor,
    ],
  );
  const firstListing =
    listingSnapshot?.query === listQuery && listingSnapshot.revision === revision
      ? listingSnapshot.value
      : undefined;
  const feed = useCursorFileFeed(
    !loading && !navigating && !queryInvalid && preferenceReady ? firstListing : undefined,
    listQuery,
    port.list,
  );
  const listing = feed.listing ?? firstListing;
  const iconsByExtension = useMemo(() => {
    const lookup = new Map<string, FileIconRule>();
    for (const rule of iconRules)
      for (const extension of rule.extensions) lookup.set(extension, rule);
    return lookup;
  }, [iconRules]);
  useEffect(() => {
    const controller = new AbortController();
    void port.readActiveFileIcons(controller.signal).then(
      (rules) => {
        if (controller.signal.aborted) return;
        setIconRules(rules);
        setIconRulesUnavailable(false);
      },
      () => {
        if (controller.signal.aborted) return;
        setIconRules([]);
        setIconRulesUnavailable(true);
      },
    );
    return () => controller.abort();
  }, [port, revision]);

  function goToNumberedPage(nextPage: number) {
    fileContent.current?.scrollIntoView({ block: 'start' });
    fileContent.current?.focus({ preventScroll: true });
    navigate({
      parent,
      category,
      trash: trash ? 'true' : '',
      search,
      filter: filterKey,
      page: String(nextPage),
    });
  }
  function restartCursor() {
    fileContent.current?.scrollIntoView({ block: 'start' });
    if (cursor) firstPage();
    else reload();
  }

  useEffect(() => {
    const controller = new AbortController();
    setPreferenceSnapshot(undefined);
    setPreferenceFailure('');
    void port
      .loadPreferences(controller.signal)
      .then((snapshot) => {
        if (!controller.signal.aborted) {
          setPreferenceSnapshot(snapshot);
          setPreferences(resolveFileView(snapshot.configuration, preferenceParent));
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setPreferenceFailure(t('files.preferences.failure', { reason: errorText(error) }));
      });
    return () => controller.abort();
  }, [port, t, errorText, preferenceParent, preferenceReload]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailure('');
    setSelected([]);
    setSelectionAnchor('');
    setFocusedEntry('');
    if (queryInvalid) {
      setListingSnapshot(undefined);
      setFailure(t('files.discovery.invalidLink'));
      setLoading(false);
      setNavigating(false);
      return () => controller.abort();
    }
    if (cursorWaitingForPreferences) return () => controller.abort();
    port
      .list(listQuery, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setListingSnapshot({ query: listQuery, revision, value });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setListingSnapshot(undefined);
          setFailure(
            cursor && error instanceof FilesError && ['invalid', 'conflict'].includes(error.code)
              ? chinese
                ? '此翻页位置已失效，请从第一页重新浏览。'
                : 'This page position has expired. Start again from the first page.'
              : error instanceof FilesError && error.code === 'large'
                ? t('files.discovery.budgetExceeded')
                : errorText(error),
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setNavigating(false);
        }
      });
    return () => controller.abort();
  }, [
    port,
    listQuery,
    cursor,
    cursorWaitingForPreferences,
    queryInvalid,
    revision,
    errorText,
    chinese,
    t,
  ]);
  useEffect(() => {
    if (!destinationDialogOpen) return;
    const controller = new AbortController();
    setFolders(undefined);
    port
      .list(
        { parent: destination, category: '', search: '', trash: false, sort: 'name', desc: false },
        controller.signal,
      )
      .then((value) => {
        if (!controller.signal.aborted) setFolders(value);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setDialogFailure(errorText(error));
      });
    return () => controller.abort();
  }, [port, destinationDialogOpen, destination, errorText]);

  const clipboard = useSyncExternalStore(
    port.clipboard.subscribe,
    port.clipboard.getSnapshot,
    port.clipboard.getSnapshot,
  );
  const [pasteFailures, setPasteFailures] = useState<readonly { name: string; reason: string }[]>(
    [],
  );
  const pasteAllowed =
    !trash && !category && !search && !filterKey && !loading && !navigating && !!listing;
  const queueClipboard = useCallback(
    (mode: FileClipboardMode, entries: FileEntry[]) => {
      try {
        port.clipboard.set(mode, entries);
        setPasteFailures([]);
      } catch (error) {
        setNotice(
          error instanceof FilesError && ['invalid', 'large'].includes(error.code)
            ? t('files.explorer.limit', { count: fileClipboardMaxEntries })
            : errorText(error),
        );
      }
    },
    [port, t, errorText],
  );
  const pasteClipboard = useCallback(async () => {
    if (!pasteAllowed || clipboard.pending || !clipboard.entries.length) return;
    setPasteFailures([]);
    setNotice('');
    try {
      const result = await port.clipboard.paste(parent);
      setNotice(t('files.explorer.pasteDone', { count: result.completed }));
      setPasteFailures(
        result.failures.map((item) => ({ name: item.entry.name, reason: errorText(item.error) })),
      );
      reload();
    } catch (error) {
      setNotice(errorText(error));
      reload();
    }
  }, [
    port,
    parent,
    pasteAllowed,
    clipboard.pending,
    clipboard.entries.length,
    t,
    errorText,
    reload,
  ]);
  const enqueue = useCallback(
    (candidates: readonly UploadCandidate[]) => {
      if (trash || !listing) {
        for (const candidate of candidates) port.releaseCandidate(candidate.id);
        return;
      }
      void transfers.enqueue(candidates, parent).catch((error) => setNotice(errorText(error)));
    },
    [trash, listing, parent, port, transfers, errorText],
  );
  useEffect(() => port.subscribeDrop(enqueue), [port, enqueue]);
  useEffect(() => () => previewController.current?.abort(), []);
  const completedRevision = useRef(transferState.completedRevision);
  useEffect(() => {
    if (completedRevision.current !== transferState.completedRevision) {
      completedRevision.current = transferState.completedRevision;
      reload();
    }
  }, [transferState.completedRevision, reload]);

  async function persistPreferences(input: FilePreferenceSnapshot): Promise<boolean> {
    if (preferenceBusy || !preferenceSnapshot) return false;
    const scope = preferenceScope;
    setPreferenceBusy(true);
    setPreferenceFailure('');
    try {
      const snapshot = await port.savePreferences(input);
      if (preferenceScopeRef.current !== scope) return true;
      setPreferenceSnapshot(snapshot);
      applyPreferences(resolveFileView(snapshot.configuration, preferenceParent));
      setNotice(t('files.preferences.saved'));
      return true;
    } catch (error) {
      if (preferenceScopeRef.current === scope)
        setPreferenceFailure(t('files.preferences.failure', { reason: errorText(error) }));
      return false;
    } finally {
      setPreferenceBusy(false);
    }
  }
  function savePreferences(next: FileViewPreferences) {
    if (!preferenceSnapshot || preferenceBusy) return;
    try {
      void persistPreferences({
        ...preferenceSnapshot,
        configuration: changeFileView(preferenceSnapshot.configuration, next, preferenceParent),
      });
    } catch (error) {
      setPreferenceFailure(t('files.preferences.failure', { reason: errorText(error) }));
    }
  }
  function applyPreferences(next: FileViewPreferences) {
    const affectsQuery =
      next.sort !== preferences.sort ||
      next.desc !== preferences.desc ||
      next.foldersFirst !== preferences.foldersFirst ||
      next.pageSize !== preferences.pageSize ||
      next.view !== preferences.view;
    setPreferences(fileViewPreferencesSchema.parse(next));
    if (affectsQuery && (page !== 1 || cursor)) firstPage();
  }
  const openDialog = useCallback(
    (mode: Dialog['mode'] | 'folder', targets: FileEntry[] = []) => {
      if (mode === 'folder') {
        createInWorkspace('folder');
        return;
      }
      setNotice('');
      setDialogFailure('');
      const source = targets[0];
      const dot = source?.kind === 'file' ? source.name.lastIndexOf('.') : -1;
      const copyName = source
        ? `${t('files.copyName', { name: dot > 0 ? source.name.slice(0, dot) : source.name })}${dot > 0 ? source.name.slice(dot) : ''}`
        : '';
      setName(mode === 'rename' ? (source?.name ?? '') : mode === 'copy' ? copyName : '');
      setDestination('');
      setDialog({ mode, targets });
    },
    [t, createInWorkspace],
  );
  async function confirmDialog() {
    if (!dialog) return;
    setDialogFailure('');
    try {
      {
        const failures: FileEntry[] = [];
        let lastError: unknown;
        for (const entry of dialog.targets) {
          try {
            if (dialog.mode === 'rename')
              await port.update(entry.id, {
                name,
                ...(entry.kind === 'shortcut' ? { expectedRevision: entry.contentRevision } : {}),
              });
            else if (dialog.mode === 'copy') await port.copy(entry.id, destination, name);
            else if (dialog.mode === 'move')
              await port.update(entry.id, {
                parentId: destination,
                ...(entry.kind === 'shortcut' ? { expectedRevision: entry.contentRevision } : {}),
              });
            else if (dialog.mode === 'remove') await port.trash(entry.id);
            else await port.restore(entry.id, destination);
          } catch (error) {
            failures.push(entry);
            lastError = error;
          }
        }
        if (failures.length) {
          setDialog({ ...dialog, targets: failures });
          setDialogFailure(
            `${t('files.operationPartial', { count: failures.length })} ${errorText(lastError)}`,
          );
          reload();
          throw lastError;
        }
      }
      setNotice(t('files.operationDone'));
      reload();
    } catch (error) {
      setDialogFailure((current) => current || errorText(error));
      throw error;
    }
  }
  async function uploadVersion(entry: FileEntry) {
    try {
      const candidates = await port.chooseFiles();
      if (!candidates.length) return;
      if (candidates.length !== 1) {
        for (const candidate of candidates) port.releaseCandidate(candidate.id);
        setNotice(t('files.versions.singleFile'));
        return;
      }
      const candidate = candidates[0];
      if (candidate) await transfers.replace(candidate, entry);
    } catch (error) {
      setNotice(errorText(error));
    }
  }
  function showDetails(entry: FileEntry) {
    setDetail(entry);
  }
  const launchApplication = useCallback(
    async (entry: FileEntry, application: FileApplicationID, signal: AbortSignal) => {
      setApplicationPicker(undefined);
      switch (application) {
        case 'archive':
          setArchiveEntry(entry);
          return;
        case 'pdf':
          setPdfEntry(entry);
          return;
        case 'epub':
          setEpubEntry(entry);
          return;
        case 'markdown':
          setTextRequest({ mode: 'edit', entry, reading: true });
          return;
        case 'image':
        case 'audio':
        case 'video':
          setMediaEntry(entry);
          return;
        case 'text':
          break;
      }
      setPreview({ entry, text: '', loading: true });
      try {
        const text = await port.preview(entry, signal);
        if (!signal.aborted) setPreview({ entry, text, loading: false });
      } catch (error) {
        if (!signal.aborted)
          setPreview({
            entry,
            text:
              error instanceof FilesError && error.code === 'unsupported'
                ? t('files.unsupportedPreview')
                : errorText(error),
            loading: false,
          });
      }
    },
    [port, t, errorText],
  );
  const showPreview = useCallback(
    async (entry: FileEntry, requested?: 'choose' | 'archive') => {
      if (entry.kind === 'shortcut') {
        navigation.openShortcut(entry.id);
        return;
      }
      if (entry.kind !== 'file') return;
      previewController.current?.abort();
      const controller = new AbortController();
      previewController.current = controller;
      if (requested === 'choose') setApplicationPicker({ entry });
      try {
        const policy = await port.readActiveFileApplications(controller.signal);
        if (controller.signal.aborted) return;
        const choice = fileApplicationChoice(
          policy,
          compatibleFileApplications(entry),
          fileIconExtension(entry.name),
          window.innerWidth < mobileFileApplicationWidth ? 'mobile' : 'desktop',
        );
        const selected =
          requested === 'archive'
            ? choice.options.find((id) => id === requested)
            : requested === 'choose'
              ? undefined
              : choice.automatic;
        if (selected) await launchApplication(entry, selected, controller.signal);
        else
          setApplicationPicker({ entry, options: requested === 'archive' ? [] : choice.options });
      } catch (error) {
        if (!controller.signal.aborted) setApplicationPicker({ entry, error: errorText(error) });
      }
    },
    [port, navigation, launchApplication, errorText],
  );
  async function download(entry: FileEntry) {
    try {
      await port.download(entry);
    } catch (error) {
      setNotice(errorText(error));
    }
  }
  const selectedIds = useMemo(() => new Set(selected), [selected]);
  const targets = useMemo(
    () => listing?.items.filter((entry) => selectedIds.has(entry.id)) ?? [],
    [listing, selectedIds],
  );
  const pageCount = listing
    ? Math.max(1, Math.ceil(listing.items.length / listing.maxGalleryEntries))
    : 0;
  const currentGalleryPage = Math.min(galleryPage, Math.max(0, pageCount - 1));
  const visibleItems = useMemo(
    () =>
      listing
        ? preferences.view === 'gallery'
          ? listing.items.slice(
              currentGalleryPage * listing.maxGalleryEntries,
              (currentGalleryPage + 1) * listing.maxGalleryEntries,
            )
          : listing.items
        : [],
    [listing, preferences.view, currentGalleryPage],
  );
  useEffect(
    () => setGalleryPage(0),
    [parent, category, trash, search, filterKey, preferences.view],
  );
  const visibleIds = useMemo(() => visibleItems.map((entry) => entry.id), [visibleItems]);
  useEffect(() => {
    const controller = new AbortController();
    setGalleryAnnotations([]);
    setGalleryAnnotationFailure('');
    if (preferences.view !== 'gallery' || !visibleIds.length) {
      setGalleryAnnotationsLoading(false);
      return () => controller.abort();
    }
    setGalleryAnnotationsLoading(true);
    void port.annotations
      .summaries(visibleIds, trash ? 'trash' : 'active', controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setGalleryAnnotations(value.items);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setGalleryAnnotationFailure(errorText(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setGalleryAnnotationsLoading(false);
      });
    return () => controller.abort();
  }, [port, preferences.view, trash, visibleIds, revision, errorText]);
  const annotationMap = useMemo(
    () =>
      new Map(
        (preferences.view === 'gallery'
          ? galleryAnnotations
          : (listing?.annotationSummaries ?? [])
        ).map((value) => [value.entryId, value]),
      ),
    [preferences.view, galleryAnnotations, listing],
  );
  function openTagsBatch(mode: 'add' | 'remove') {
    if (!listing || !targets.length) return;
    if (targets.length > listing.annotationLimits.maxBatchEntries) {
      setNotice(
        t('files.annotations.batchLimit', { count: listing.annotationLimits.maxBatchEntries }),
      );
      return;
    }
    const summaries: FileAnnotationSummary[] = [];
    for (const entry of targets) {
      const summary = annotationMap.get(entry.id);
      if (!summary) {
        setNotice(t('files.errors.unavailable'));
        return;
      }
      summaries.push(summary);
    }
    setTagsBatch({ mode, targets: summaries });
  }
  const thumbnailIds = useMemo(
    () =>
      new Set(
        visibleItems
          .filter(
            (entry) =>
              entry.kind === 'file' &&
              !annotationMap.get(entry.id)?.emoji &&
              entry.mediaType.startsWith('image/') &&
              listing &&
              entry.sizeBytes <= listing.maxThumbnailBytes,
          )
          .slice(0, listing?.maxGalleryEntries ?? 0)
          .map((entry) => entry.id),
      ),
    [visibleItems, listing, annotationMap],
  );
  function selectEntry(id: string, gesture: FileSelectionGesture) {
    if (gesture.extend) {
      const range = fileSelectionRange(visibleIds, selectionAnchor || focusedEntry || id, id);
      setSelected((current) =>
        gesture.toggle ? [...new Set([...current, ...range])] : [...range],
      );
    } else {
      setSelectionAnchor(id);
      setSelected((current) =>
        gesture.toggle
          ? current.includes(id)
            ? current.filter((value) => value !== id)
            : [...current, id]
          : [id],
      );
    }
    setFocusedEntry(id);
  }
  useEffect(
    () =>
      port.subscribeShortcuts((shortcut) => {
        const chosen = targets;
        if (
          shortcut === 'next' ||
          shortcut === 'previous' ||
          shortcut === 'first' ||
          shortcut === 'last' ||
          shortcut === 'extendNext' ||
          shortcut === 'extendPrevious' ||
          shortcut === 'extendFirst' ||
          shortcut === 'extendLast'
        ) {
          const direction =
            shortcut === 'extendNext'
              ? 'next'
              : shortcut === 'extendPrevious'
                ? 'previous'
                : shortcut === 'extendFirst'
                  ? 'first'
                  : shortcut === 'extendLast'
                    ? 'last'
                    : shortcut;
          const ids = visibleIds,
            next = nextFileFocus(ids, focusedEntry, direction);
          if (next) {
            if (shortcut.startsWith('extend')) {
              const range = fileSelectionRange(ids, selectionAnchor || focusedEntry || next, next);
              if (!selectionAnchor) setSelectionAnchor(focusedEntry || next);
              setSelected([...range]);
            }
            setFocusedEntry(next);
            port.focusEntry(next);
          }
          return;
        }
        if (shortcut === 'copySelection' || shortcut === 'cutSelection') {
          if (!trash && !loading && !navigating && chosen.length)
            queueClipboard(shortcut === 'copySelection' ? 'copy' : 'cut', chosen);
        } else if (shortcut === 'pasteSelection') void pasteClipboard();
        else if (shortcut === 'parentFolder') {
          if (parent && !trash && !category && !loading && !navigating)
            navigate({ parent: listing?.breadcrumbs.at(-2)?.id ?? '' });
        } else if (shortcut === 'search') port.focusSearch();
        else if (shortcut === 'refresh') reload();
        else if (shortcut === 'selectAll') setSelected([...visibleIds]);
        else if (shortcut === 'clearSelection') setSelected([]);
        else if (shortcut === 'newFolder' && !trash && listing) openDialog('folder');
        else if (shortcut === 'rename' && !trash && chosen.length === 1)
          openDialog('rename', chosen);
        else if (shortcut === 'trash' && !trash && chosen.length) openDialog('remove', chosen);
        else if ((shortcut === 'open' && chosen.length === 1) || shortcut === 'openFocused') {
          const entry =
            shortcut === 'openFocused'
              ? listing?.items.find((item) => item.id === focusedEntry)
              : chosen[0];
          if (!entry) return;
          if (trash) openDialog('restore', [entry]);
          else if (entry.kind === 'folder') navigate({ parent: entry.id });
          else void showPreview(entry);
        }
      }),
    [
      port,
      listing,
      targets,
      trash,
      navigate,
      openDialog,
      showPreview,
      reload,
      visibleIds,
      focusedEntry,
      selectionAnchor,
      queueClipboard,
      pasteClipboard,
      parent,
      category,
      loading,
      navigating,
    ],
  );
  const title = trash
    ? t('files.trash')
    : category
      ? t(`files.${category}`)
      : (listing?.breadcrumbs.at(-1)?.name ?? t('files.nav'));
  return (
    <>
      <div className="flex min-h-full min-w-0 flex-col gap-3">
        <h1 className="sr-only">{title}</h1>
        <Toolbar
          label={title}
          primary={
            <>
              <div
                data-file-breadcrumbs
                className="flex w-full min-w-0 items-center gap-2 overflow-x-auto md:w-auto md:flex-1"
              >
                {parent && !trash && !category ? (
                  <Action
                    size="sm"
                    variant="quiet"
                    disabled={loading || navigating}
                    onPress={() => navigate({ parent: listing?.breadcrumbs.at(-2)?.id ?? '' })}
                  >
                    {t('files.explorer.parent')}
                  </Action>
                ) : null}
                <MenuButton
                  ariaLabel={t('files.explorer.ancestors')}
                  label={<MoreHorizontal className="size-4" />}
                  triggerSize="sm"
                  items={[
                    { id: 'root', label: t('files.nav') },
                    ...(listing?.breadcrumbs.map((entry, index) => ({
                      id: entry.id,
                      label: index === 0 ? '/' + entry.name : String(index + 1) + '. ' + entry.name,
                    })) ?? []),
                  ]}
                  onAction={(id) => navigate({ parent: id === 'root' ? '' : id })}
                />
                <button
                  type="button"
                  onClick={() => navigate({})}
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium text-ink"
                >
                  <Home className="size-4 shrink-0" aria-hidden="true" />
                  {t('files.nav')}
                </button>
                {listing?.breadcrumbs.map((entry) => (
                  <span key={entry.id} className="flex shrink-0 items-center gap-2 text-sm">
                    <span aria-hidden="true">/</span>
                    <button
                      type="button"
                      onClick={() => navigate({ parent: entry.id })}
                      title={entry.name}
                      className="max-w-28 truncate hover:text-brand"
                    >
                      {entry.name}
                    </button>
                  </span>
                ))}
                {trash || category ? (
                  <span className="text-sm text-ink-muted">/ {title}</span>
                ) : null}
                <Action size="sm" variant="quiet" leadingIcon={<RefreshCw />} onPress={reload}>
                  {t('files.refresh')}
                </Action>
                <MenuButton
                  label={<MoreHorizontal className="size-5" />}
                  ariaLabel={t('files.discovery.folderActions')}
                  triggerSize="sm"
                  items={[
                    { id: 'save-shortcut', label: t('files.navigation.save') },
                    { id: 'pin-folder', label: t('files.navigation.pin') },
                    { id: 'copy-path', label: t('files.explorer.copyPath') },
                    {
                      id: 'select-all',
                      label: t('files.selectAll'),
                      disabled: loading || navigating || !visibleIds.length,
                    },
                    {
                      id: 'select-none',
                      label: t('files.explorer.none'),
                      disabled: !selected.length,
                    },
                    {
                      id: 'select-invert',
                      label: t('files.explorer.invert'),
                      disabled: loading || navigating || !visibleIds.length,
                    },
                  ]}
                  onAction={(action) => {
                    if (action === 'copy-path')
                      void port.annotations
                        .copyText(
                          '/' + (listing?.breadcrumbs.map((entry) => entry.name).join('/') ?? ''),
                        )
                        .then(() => setNotice(t('files.explorer.pathCopied')))
                        .catch((error) => setNotice(errorText(error)));
                    else if (action === 'select-all') setSelected([...visibleIds]);
                    else if (action === 'select-none') setSelected([]);
                    else if (action === 'select-invert')
                      setSelected(visibleIds.filter((id) => !selectedIds.has(id)));
                    else if (action === 'save-shortcut') setSaveShortcut(true);
                    else if (action === 'pin-folder')
                      setPinTarget({ targetKind: 'folder', targetId: parent });
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={loading || navigating}
                  onPress={() => setAdvancedOpen(true)}
                >
                  {t('files.discovery.advanced')}
                </Action>
                <MenuButton
                  triggerSize="sm"
                  ariaLabel={t('files.explorer.view')}
                  label={
                    <span className="flex items-center gap-2">
                      <LayoutGrid className="size-4" />
                      {t('files.explorer.view')}
                    </span>
                  }
                  items={['grid', 'list', 'gallery']
                    .map((view) => ({
                      id: view,
                      label: t('files.' + view),
                      description: preferences.view === view ? '✓' : '',
                    }))
                    .concat([
                      {
                        id: 'options',
                        label: t('files.discovery.viewOptions'),
                        description: '',
                      },
                    ])
                    .map((item) => ({ ...item, disabled: preferenceBusy || !preferenceSnapshot }))}
                  onAction={(view) =>
                    view === 'options'
                      ? setViewOptionsOpen(true)
                      : savePreferences({
                          ...preferences,
                          view: view as FileViewPreferences['view'],
                        })
                  }
                />
                <MenuButton
                  triggerSize="sm"
                  ariaLabel={t('files.explorer.sort')}
                  label={
                    <span className="flex items-center gap-2">
                      <ArrowUpDown className="size-4" />
                      {t('files.explorer.sort')}
                    </span>
                  }
                  items={[
                    ...['name', 'size', 'updated', 'created'].map((sort) => ({
                      id: sort,
                      label: t('files.' + sort + 'Sort'),
                      description: preferences.sort === sort ? '✓' : '',
                    })),
                    {
                      id: 'asc',
                      label: t('files.explorer.ascending'),
                      description: !preferences.desc ? '✓' : '',
                    },
                    {
                      id: 'desc',
                      label: t('files.explorer.descending'),
                      description: preferences.desc ? '✓' : '',
                    },
                  ].map((item) => ({ ...item, disabled: preferenceBusy || !preferenceSnapshot }))}
                  onAction={(sort) =>
                    savePreferences({
                      ...preferences,
                      ...(sort === 'asc' || sort === 'desc'
                        ? { desc: sort === 'desc' }
                        : { sort: sort as FileViewPreferences['sort'] }),
                    })
                  }
                />
              </div>
            </>
          }
        />
        {listing && !loading && !navigating ? (
          <p role="status" className="text-xs text-ink-muted">
            {t('files.explorer.results', {
              count: listing.total,
              scope: trash
                ? t('files.explorer.scopeTrash')
                : filters.scope === 'tree'
                  ? t('files.explorer.scopeTree')
                  : filters.scope === 'all' ||
                      (!filters.scope &&
                        (search ||
                          category ||
                          filters.keywords ||
                          filters.tagFilter ||
                          filters.property))
                    ? t('files.explorer.scopeAll')
                    : t('files.explorer.scopeFolder'),
            })}
          </p>
        ) : null}
        {clipboard.entries.length ? (
          <section
            aria-label={t(
              clipboard.mode === 'cut'
                ? 'files.explorer.clipboardCut'
                : 'files.explorer.clipboardCopy',
              { count: clipboard.entries.length },
            )}
            className="rounded-control border border-brand bg-brand-soft p-3 text-sm"
          >
            <p className="font-semibold">
              {t(
                clipboard.mode === 'cut'
                  ? 'files.explorer.clipboardCut'
                  : 'files.explorer.clipboardCopy',
                { count: clipboard.entries.length },
              )}
            </p>
            <p
              className="truncate text-xs"
              title={clipboard.entries.map((entry) => entry.name).join(', ')}
            >
              {clipboard.entries.map((entry) => entry.name).join(', ')}
            </p>
            <p className="mt-1 text-xs text-ink-muted">{t('files.explorer.clipboardHint')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Action
                size="sm"
                disabled={!pasteAllowed || clipboard.pending}
                loading={clipboard.pending}
                onPress={() => void pasteClipboard()}
              >
                {t('files.explorer.paste')}
              </Action>
              <Action
                size="sm"
                variant="quiet"
                disabled={clipboard.pending}
                onPress={() => {
                  port.clipboard.clear();
                  setPasteFailures([]);
                }}
              >
                {t('files.explorer.clearClipboard')}
              </Action>
            </div>
            {!pasteAllowed ? (
              <p className="mt-1 text-xs">{t('files.explorer.pasteLocation')}</p>
            ) : null}
          </section>
        ) : null}
        {pasteFailures.length ? (
          <ul role="alert" className="rounded-control border border-danger p-3 text-sm text-danger">
            {pasteFailures.map((failure, index) => (
              <li key={index}>{t('files.explorer.pasteFailed', failure)}</li>
            ))}
          </ul>
        ) : null}
        <ActiveFilterChips
          filters={filters}
          onChange={(next) =>
            navigate({
              parent,
              category,
              trash: trash ? 'true' : '',
              search,
              filter: encodeFileFilters(next),
            })
          }
        />
        {cursor && failure && !loading ? (
          <Action variant="secondary" onPress={firstPage}>
            {t('files.discovery.firstPage')}
          </Action>
        ) : queryInvalid ? (
          <Action
            variant="secondary"
            onPress={() => navigate({ parent, category, trash: trash ? 'true' : '' })}
          >
            {t('files.discovery.clear')}
          </Action>
        ) : null}
        {!preferenceSnapshot && !preferenceFailure ? (
          <p role="status" className="text-sm text-ink-muted">
            {t('files.preferences.loading')}
          </p>
        ) : null}
        {preferenceBusy ? (
          <p role="status" className="text-sm text-ink-muted">
            {t('files.preferences.saving')}
          </p>
        ) : null}
        {preferenceFailure ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-danger">
            <p>{preferenceFailure}</p>
            <Action
              size="sm"
              variant="quiet"
              disabled={preferenceBusy}
              onPress={() => {
                setViewOptionsOpen(false);
                setPreferenceReload((value) => value + 1);
              }}
            >
              {t('files.preferences.reload')}
            </Action>
          </div>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-control border border-border bg-surface p-3 text-sm">
            {notice}
          </p>
        ) : null}
        {queuedZIPName ? (
          <div className="flex flex-wrap items-center gap-2 rounded-control border border-border bg-surface p-3 text-sm">
            <span role="status">
              {t('files.archives.createZIP.queued', { name: queuedZIPName })}
            </span>
            <Action size="sm" variant="quiet" onPress={() => port.navigate('tasks')}>
              {t('files.archives.tasks.open')}
            </Action>
          </div>
        ) : null}
        {galleryAnnotationsLoading ? (
          <p role="status" className="text-sm text-ink-muted">
            {t('files.annotations.loading')}
          </p>
        ) : null}
        {galleryAnnotationFailure ? (
          <p role="alert" className="text-sm text-danger">
            {galleryAnnotationFailure}
          </p>
        ) : null}
        {iconRulesUnavailable ? (
          <p className="text-sm text-ink-muted" role="status">
            {chinese
              ? '文件图标规则暂不可用，当前使用类型图标。'
              : 'File icon rules are unavailable. Showing file type icons.'}
          </p>
        ) : null}
        {listing?.items.length ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-32">
              <CheckboxField
                label={t('files.discovery.selectPage')}
                checked={selected.length === visibleItems.length}
                onCheckedChange={(checked) => {
                  setSelectionAnchor('');
                  setSelected(checked ? visibleItems.map((entry) => entry.id) : []);
                }}
              />
            </div>
            {targets.length ? (
              <>
                {!trash ? (
                  <>
                    <Action
                      size="sm"
                      variant="secondary"
                      disabled={clipboard.pending}
                      onPress={() => queueClipboard('copy', targets)}
                    >
                      {t('files.explorer.copyPending')}
                    </Action>
                    <Action
                      size="sm"
                      variant="secondary"
                      disabled={clipboard.pending}
                      onPress={() => queueClipboard('cut', targets)}
                    >
                      {t('files.explorer.cutPending')}
                    </Action>
                    <Action
                      size="sm"
                      variant="secondary"
                      disabled={targets.some((entry) => entry.kind === 'shortcut')}
                      onPress={() => setZIPSelection({ entries: targets, parent })}
                    >
                      {t('files.archives.createZIP.title')}
                    </Action>
                    {targets.every((entry) => entry.kind === 'file') ? (
                      <Action
                        size="sm"
                        variant="secondary"
                        disabled={targets.length > directLinkBatchLimit}
                        onPress={() => setDirectTargets(targets)}
                      >
                        {t('files.directLinks.get')}
                      </Action>
                    ) : null}
                  </>
                ) : null}
                {!trash ? (
                  <Action
                    size="sm"
                    variant="secondary"
                    loading={archiving}
                    disabled={archiving || targets.some((entry) => entry.kind === 'shortcut')}
                    onPress={() => {
                      setArchiving(true);
                      setNotice('');
                      void port
                        .archive(selected)
                        .then(() => setNotice(t('files.archiveReady')))
                        .catch((error: unknown) => setNotice(errorText(error)))
                        .finally(() => setArchiving(false));
                    }}
                  >
                    {t('files.archive')}
                  </Action>
                ) : null}
                <span className="text-sm text-ink-muted">
                  {t('files.selected', { count: targets.length })}
                </span>
                <span className="text-xs text-ink-muted">
                  {t('files.explorer.selectedBytes', {
                    size: bytes(
                      targets.reduce(
                        (sum, entry) => sum + (entry.kind === 'file' ? entry.sizeBytes : 0),
                        0,
                      ),
                    ),
                  })}
                </span>
                {!trash ? (
                  <>
                    <Action
                      size="sm"
                      variant="secondary"
                      disabled={
                        loading ||
                        navigating ||
                        galleryAnnotationsLoading ||
                        !!galleryAnnotationFailure
                      }
                      onPress={() => openTagsBatch('add')}
                    >
                      {t('files.annotations.batchAdd')}
                    </Action>
                    <Action
                      size="sm"
                      variant="secondary"
                      disabled={
                        loading ||
                        navigating ||
                        galleryAnnotationsLoading ||
                        !!galleryAnnotationFailure
                      }
                      onPress={() => openTagsBatch('remove')}
                    >
                      {t('files.annotations.batchRemove')}
                    </Action>
                  </>
                ) : null}
                {trash ? (
                  <>
                    <Action
                      variant="secondary"
                      size="sm"
                      onPress={() => openDialog('restore', targets)}
                    >
                      {t('files.restore')}
                    </Action>
                    <Action
                      variant="danger"
                      size="sm"
                      disabled={loading || navigating}
                      onPress={() =>
                        setTrashSelection({
                          scope: 'selection',
                          ids: targets.map((entry) => entry.id),
                        })
                      }
                    >
                      {t('files.trashPurge.permanent')}
                    </Action>
                  </>
                ) : (
                  <>
                    <Action
                      variant="secondary"
                      size="sm"
                      onPress={() => openDialog('move', targets)}
                    >
                      {t('files.move')}
                    </Action>
                    <Action
                      variant="danger"
                      size="sm"
                      onPress={() => openDialog('remove', targets)}
                    >
                      {t('files.remove')}
                    </Action>
                  </>
                )}
              </>
            ) : null}
          </div>
        ) : null}
        <section
          ref={fileContent}
          tabIndex={-1}
          aria-label={title}
          aria-busy={loading || navigating}
          data-file-content
          className={`min-h-96 min-w-0 flex-1 rounded-panel border border-border bg-surface p-3 ${!loading && !navigating && !failure && !listing?.items.length ? 'flex flex-col' : ''}`}
        >
          <h1 className="sr-only">{title}</h1>
          {loading || navigating ? (
            <StateSurface
              state="loading"
              icon={<Cloud />}
              title={t('files.loading')}
              description={t('files.loadingDescription')}
            />
          ) : failure ? (
            <StateSurface
              state="error"
              icon={<Cloud />}
              title={t('files.error')}
              description={failure}
              actionLabel={t('files.retry')}
              onAction={reload}
            />
          ) : !listing?.items.length ? (
            <div data-file-empty className="grid min-h-80 flex-1 place-items-center">
              <StateSurface
                state="empty"
                icon={trash ? <Trash2 /> : <Upload />}
                title={t(
                  trash
                    ? 'files.emptyTrash'
                    : search || category
                      ? 'files.emptySearch'
                      : 'files.empty',
                )}
                description={t(
                  search || category ? 'files.emptySearchDescription' : 'files.emptyDescription',
                )}
                {...(!trash && !search && !category && !filterKey
                  ? {
                      actionLabel: t('files.upload'),
                      onAction: () => {
                        void port
                          .chooseFiles()
                          .then(enqueue)
                          .catch((error: unknown) => setNotice(errorText(error)));
                      },
                    }
                  : {})}
              />
            </div>
          ) : (
            <div
              role={preferences.view === 'list' ? 'table' : undefined}
              aria-label={preferences.view === 'list' ? title : undefined}
              className={
                preferences.view === 'grid'
                  ? 'grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6'
                  : 'flex flex-col divide-y divide-border'
              }
            >
              {preferences.view === 'list' ? (
                <FileListHeader
                  preferences={preferences}
                  onSort={(sort) =>
                    savePreferences({
                      ...preferences,
                      sort,
                      desc: preferences.sort === sort ? !preferences.desc : false,
                    })
                  }
                />
              ) : null}
              {visibleItems.map((entry, index) => (
                <FileItem
                  key={entry.id}
                  entry={entry}
                  annotation={annotationMap.get(entry.id)}
                  iconRule={
                    entry.kind === 'file'
                      ? iconsByExtension.get(fileIconExtension(entry.name))
                      : undefined
                  }
                  onTag={(name) =>
                    navigate({
                      filter: encodeFileFilters({
                        scope: 'all',
                        tagFilter: { names: [name], match: 'all' },
                      }),
                    })
                  }
                  view={preferences.view}
                  folderClick={preferenceSnapshot?.configuration.folderClick}
                  columns={preferences.columns}
                  selected={selectedIds.has(entry.id)}
                  cut={
                    clipboard.mode === 'cut' &&
                    clipboard.entries.some((item) => item.id === entry.id)
                  }
                  tabStop={focusedEntry === entry.id || (!focusedEntry && index === 0)}
                  onFocus={() => setFocusedEntry(entry.id)}
                  onOpen={() => {
                    if (trash) openDialog('restore', [entry]);
                    else if (entry.kind === 'folder') navigate({ parent: entry.id });
                    else void showPreview(entry);
                  }}
                  onSelect={(gesture) => selectEntry(entry.id, gesture)}
                  onChecked={(checked) => {
                    setSelectionAnchor(entry.id);
                    setSelected((current) =>
                      checked
                        ? [...new Set([...current, entry.id])]
                        : current.filter((id) => id !== entry.id),
                    );
                  }}
                  onContext={() => {
                    setContextEntry(entry.id);
                    setSelectionAnchor(entry.id);
                    if (!selectedIds.has(entry.id)) setSelected([entry.id]);
                  }}
                  thumbnail={
                    preferences.thumbnails &&
                    thumbnailIds.has(entry.id) &&
                    listing &&
                    entry.sizeBytes <= listing.maxThumbnailBytes ? (
                      <FileMedia
                        key={entry.id + ':' + entry.contentRevision}
                        entry={entry}
                        mode="thumbnail"
                        maxBytes={listing.maxThumbnailBytes}
                      />
                    ) : null
                  }
                  actions={
                    <MenuButton
                      label={<MoreHorizontal className="size-5" />}
                      ariaLabel={t('files.actionsFor', { name: entry.name })}
                      triggerSize="sm"
                      isOpen={contextEntry === entry.id}
                      onOpenChange={(open) => setContextEntry(open ? entry.id : undefined)}
                      items={
                        trash
                          ? [
                              { id: 'restore', label: t('files.restore') },
                              ...(entry.kind === 'shortcut'
                                ? [
                                    {
                                      id: 'purge',
                                      label: t('files.navigation.purge'),
                                      tone: 'danger' as const,
                                    },
                                  ]
                                : [
                                    {
                                      id: 'purge-file',
                                      label: t('files.trashPurge.permanent'),
                                      tone: 'danger' as const,
                                    },
                                  ]),
                            ]
                          : [
                              { id: 'details', label: t('files.details') },
                              {
                                id: 'queue-copy',
                                label: t('files.explorer.copyPending'),
                                disabled: clipboard.pending || entry.kind === 'shortcut',
                              },
                              {
                                id: 'queue-cut',
                                label: t('files.explorer.cutPending'),
                                disabled: clipboard.pending || entry.kind === 'shortcut',
                              },
                              { id: 'rename', label: t('files.rename') },
                              { id: 'move', label: t('files.move') },
                              { id: 'copy', label: t('files.copy') },
                              ...(entry.kind === 'file'
                                ? [
                                    { id: 'download', label: t('files.download') },
                                    { id: 'open-with', label: openWithLabel },
                                    { id: 'direct-link', label: t('files.directLinks.get') },
                                    ...(archiveFile(entry)
                                      ? [{ id: 'browse-archive', label: t('files.archives.title') }]
                                      : []),
                                    { id: 'versions', label: t('files.versions.title') },
                                    { id: 'upload-version', label: t('files.versions.upload') },
                                    ...(entry.mediaType.startsWith('text/') ||
                                    isMarkdownFile(entry) ||
                                    /\.txt$/i.test(entry.name)
                                      ? [{ id: 'edit', label: t('files.edit') }]
                                      : []),
                                  ]
                                : []),
                              ...(entry.kind === 'shortcut'
                                ? []
                                : [
                                    {
                                      id: 'create-zip',
                                      label: t('files.archives.createZIP.title'),
                                    },
                                    { id: 'share', label: t('files.share') },
                                    { id: 'access', label: t('files.access.title') },
                                  ]),
                              ...(entry.kind === 'folder' || entry.kind === 'shortcut'
                                ? [{ id: 'pin', label: t('files.navigation.pin') }]
                                : []),
                              { id: 'remove', label: t('files.remove'), tone: 'danger' },
                            ]
                      }
                      onAction={(action) => {
                        setContextEntry(undefined);
                        if (action === 'browse-archive') void showPreview(entry, 'archive');
                        else if (action === 'open-with') void showPreview(entry, 'choose');
                        else if (action === 'create-zip')
                          setZIPSelection({ entries: [entry], parent: entry.parentId });
                        else if (action === 'versions') setVersionEntry(entry);
                        else if (action === 'upload-version') void uploadVersion(entry);
                        else if (action === 'queue-copy' || action === 'queue-cut')
                          queueClipboard(
                            action === 'queue-copy' ? 'copy' : 'cut',
                            selectedIds.has(entry.id) ? targets : [entry],
                          );
                        else if (action === 'details') void showDetails(entry);
                        else if (action === 'purge') setPurgeTarget(entry);
                        else if (action === 'purge-file')
                          setTrashSelection({ scope: 'selection', ids: [entry.id] });
                        else if (
                          action === 'pin' &&
                          (entry.kind === 'folder' || entry.kind === 'shortcut')
                        )
                          setPinTarget({ targetKind: entry.kind, targetId: entry.id });
                        else if (action === 'download') void download(entry);
                        else if (action === 'direct-link') setDirectTargets([entry]);
                        else if (action === 'share') setShareTarget(entry);
                        else if (action === 'access') setAccessTarget(entry);
                        else if (action === 'edit') setTextRequest({ mode: 'edit', entry });
                        else if (
                          action === 'rename' ||
                          action === 'move' ||
                          action === 'copy' ||
                          action === 'remove' ||
                          action === 'restore'
                        )
                          openDialog(action, [entry]);
                      }}
                    />
                  }
                />
              ))}
            </div>
          )}
        </section>
        {listing && !loading && !navigating && preferences.view !== 'gallery' ? (
          listing.cursorPage ? (
            preferenceReady ? (
              <CursorFilePagination
                next={!!listing.cursorPage.next}
                previous={!!listing.cursorPage.previous}
                phase={feed.phase}
                count={listing.items.length}
                bookmarked={!!cursor}
                onLoad={feed.load}
                onPrevious={() =>
                  navigate({
                    parent,
                    category,
                    trash: trash ? 'true' : '',
                    search,
                    filter: filterKey,
                    cursor: listing.cursorPage?.previous ?? '',
                  })
                }
                onRestart={restartCursor}
              />
            ) : null
          ) : (
            <NumberedFilePagination
              page={page}
              pageSize={listing.pageSize}
              total={listing.total}
              onPage={goToNumberedPage}
            />
          )
        ) : null}
        {listing && preferences.view === 'gallery' ? (
          <p className="text-xs text-ink-muted">
            {t('files.discovery.galleryBudget', { count: listing.maxGalleryEntries })}
          </p>
        ) : null}
        <p className="text-xs text-ink-muted">{t('files.discovery.keyboardHint')}</p>
        {listing && preferences.thumbnails && thumbnailIds.size > 0 ? (
          <p className="text-xs text-ink-muted">
            {t('files.discovery.thumbnailBudget', { count: listing.maxGalleryEntries })}
          </p>
        ) : null}
        {listing && preferences.view === 'gallery' && pageCount > 1 ? (
          <div className="flex flex-wrap items-center gap-3">
            <Action
              variant="secondary"
              size="sm"
              disabled={currentGalleryPage === 0}
              onPress={() => {
                setGalleryPage(currentGalleryPage - 1);
                setSelected([]);
                setSelectionAnchor('');
                setFocusedEntry('');
              }}
            >
              {t('files.previousPage')}
            </Action>
            <span className="text-sm text-ink-muted">
              {t('files.galleryPage', { current: currentGalleryPage + 1, pages: pageCount })}
            </span>
            <Action
              variant="secondary"
              size="sm"
              disabled={currentGalleryPage + 1 >= pageCount}
              onPress={() => {
                setGalleryPage(currentGalleryPage + 1);
                setSelected([]);
                setSelectionAnchor('');
                setFocusedEntry('');
              }}
            >
              {t('files.nextPage')}
            </Action>
          </div>
        ) : null}
        {listing ? (
          <p className="text-xs text-ink-muted">
            {t('files.uploadLimit', {
              size: bytes(listing.maxFileBytes),
              count: listing.concurrentUploads,
            })}
          </p>
        ) : null}
      </div>
      {dialog ? (
        <DialogSurface
          triggerLabel={t(`files.${dialog.mode}`)}
          title={t(`files.${dialog.mode}`)}
          description={t(
            dialog.mode === 'remove'
              ? 'files.removeHint'
              : dialog.mode === 'move'
                ? 'files.destinationHint'
                : dialog.mode === 'restore'
                  ? 'files.restoreHint'
                  : 'files.nameHint',
          )}
          cancelLabel={t('files.cancel')}
          confirmLabel={t('files.confirm')}
          isOpen
          onOpenChange={(open) => {
            if (!open) setDialog(undefined);
          }}
          {...(dialogFailure ? { failureMessage: dialogFailure } : {})}
          onConfirm={confirmDialog}
          confirmDisabled={
            dialog.mode === 'rename'
              ? !name.trim()
              : dialog.mode === 'copy'
                ? !folders || !name.trim()
                : dialog.mode === 'move' || dialog.mode === 'restore'
                  ? !folders
                  : false
          }
        >
          {dialog.mode === 'copy' ? (
            <TextField
              label={t('files.name')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          ) : null}
          {dialog.mode === 'rename' ? (
            <TextField
              label={t('files.name')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          ) : dialog.mode === 'move' || dialog.mode === 'restore' || dialog.mode === 'copy' ? (
            <div className="space-y-3">
              <Action variant="secondary" onPress={() => setDestination('')}>
                {t('files.nav')}
              </Action>
              <p className="break-words text-sm">
                {t('files.currentDestination')}: /
                {folders?.breadcrumbs.map((entry) => entry.name).join('/')}
              </p>
              {!folders ? (
                <p role="status">{t('files.loading')}</p>
              ) : (
                <ul className="space-y-2">
                  {folders.items
                    .filter((entry) => entry.kind === 'folder')
                    .map((entry) => (
                      <li key={entry.id}>
                        <Action variant="quiet" onPress={() => setDestination(entry.id)}>
                          {entry.name}
                        </Action>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {dialog.targets.map((entry) => (
                <li key={entry.id} className="break-words">
                  {entry.name}
                </li>
              ))}
            </ul>
          )}
        </DialogSurface>
      ) : null}
      {advancedOpen ? (
        <AdvancedSearchDialog
          filters={filters}
          search={search}
          parent={parent}
          onClose={() => setAdvancedOpen(false)}
          onApply={(next) => {
            const encoded = encodeFileFilters(next);
            setAdvancedOpen(false);
            navigate({ parent, category, trash: trash ? 'true' : '', filter: encoded });
          }}
        />
      ) : null}
      {viewOptionsOpen && preferenceSnapshot ? (
        <ViewOptionsDialog
          preferences={preferences}
          maxPageSize={listing?.maxPageSize}
          snapshot={preferenceSnapshot}
          parentId={preferenceParent}
          busy={preferenceBusy}
          failure={preferenceFailure}
          onLoadServer={async () => {
            if (preferenceBusy) return;
            setPreferenceBusy(true);
            setPreferenceFailure('');
            const scope = preferenceScope;
            try {
              const snapshot = await port.loadPreferences(undefined, 'server');
              if (preferenceScopeRef.current !== scope) return;
              setPreferenceSnapshot(snapshot);
              applyPreferences(resolveFileView(snapshot.configuration, preferenceParent));
              setViewOptionsOpen(false);
            } catch (error) {
              if (preferenceScopeRef.current === scope)
                setPreferenceFailure(t('files.preferences.failure', { reason: errorText(error) }));
            } finally {
              setPreferenceBusy(false);
            }
          }}
          onClose={() => setViewOptionsOpen(false)}
          onSave={persistPreferences}
        />
      ) : null}
      {accessTarget ? (
        <Suspense fallback={<p role="status">{t('files.access.loading')}</p>}>
          <FileAccessDialog
            entry={accessTarget}
            onClose={() => setAccessTarget(undefined)}
            onSaved={() => {
              setAccessTarget(undefined);
              setNotice(t('files.access.saved'));
              reload();
            }}
          />
        </Suspense>
      ) : null}
      {shareTarget ? (
        <ShareDialog entry={shareTarget} onClose={() => setShareTarget(undefined)} />
      ) : null}
      {directTargets ? (
        <Suspense>
          <DirectLinksDialog entries={directTargets} onClose={() => setDirectTargets(undefined)} />
        </Suspense>
      ) : null}
      {saveShortcut ? (
        <SaveShortcutDialog
          parentId={parent}
          onClose={() => setSaveShortcut(false)}
          onSaved={() => {
            setSaveShortcut(false);
            reload();
          }}
        />
      ) : null}
      {trash && trashSelection ? (
        <Suspense>
          <TrashPurgeDialog
            selection={trashSelection}
            onClose={() => setTrashSelection(undefined)}
            onPurged={(receipt) => {
              setSelected([]);
              setNotice(
                t('files.trashPurge.done', {
                  entries: receipt.entryCount,
                  bytes: bytes(receipt.bytes),
                }),
              );
              reload();
              if (page > 1)
                navigate({ parent, category, trash: 'true', search, filter: filterKey });
            }}
          />
        </Suspense>
      ) : null}
      {purgeTarget ? (
        <ShortcutActionDialog
          entry={purgeTarget}
          action="purge"
          onClose={() => setPurgeTarget(undefined)}
          onChanged={() => {
            setPurgeTarget(undefined);
            reload();
          }}
        />
      ) : null}
      {pinTarget ? (
        <PinDialog
          target={pinTarget}
          onClose={() => setPinTarget(undefined)}
          onChanged={() => {
            setPinTarget(undefined);
            reload();
          }}
        />
      ) : null}
      {textRequest && listing ? (
        <TextDialog
          request={textRequest}
          maxBytes={listing.maxTextBytes}
          {...(textRequest.mode === 'edit' && isMarkdownFile(textRequest.entry)
            ? { onDownload: () => void download(textRequest.entry) }
            : {})}
          onClose={() => setTextRequest(undefined)}
          onSaved={() => {
            setNotice(t('files.operationDone'));
            reload();
          }}
        />
      ) : null}
      {pdfEntry && listing ? (
        <Suspense fallback={<p role="status">{pdfEntry.name}</p>}>
          <PdfDialog
            entry={pdfEntry}
            limits={listing.pdfReader}
            onClose={() => setPdfEntry(undefined)}
          />
        </Suspense>
      ) : null}
      {epubEntry ? (
        <Suspense fallback={<p role="status">{epubEntry.name}</p>}>
          <EpubDialog
            entry={epubEntry}
            onClose={() => setEpubEntry(undefined)}
            onDownload={() => void download(epubEntry)}
          />
        </Suspense>
      ) : null}
      {mediaEntry && listing ? (
        <DialogSurface
          triggerLabel={t('files.mediaPreview')}
          title={mediaEntry.name}
          description={t('files.mediaPreview')}
          cancelLabel={t('files.close')}
          size={videoPreview ? 'cover' : 'lg'}
          layout={videoPreview ? 'workspace' : 'standard'}
          isOpen
          onOpenChange={(open) => {
            if (!open) setMediaEntry(undefined);
          }}
        >
          <div className={videoPreview ? 'flex h-full min-h-0 flex-col gap-4' : 'space-y-4'}>
            <FileMedia
              key={mediaEntry.id + ':' + mediaEntry.contentRevision}
              entry={mediaEntry}
              mode="preview"
              maxBytes={listing.maxMediaBytes}
            />
            <div className="shrink-0">
              <Action
                variant="secondary"
                onPress={() => {
                  void download(mediaEntry);
                }}
              >
                {t('files.download')}
              </Action>
            </div>
          </div>
        </DialogSurface>
      ) : null}
      {versionEntry ? (
        <VersionsPanel
          entry={versionEntry}
          onClose={() => setVersionEntry(undefined)}
          onSaved={reload}
        />
      ) : null}
      {detail ? (
        <AnnotationPanel
          onVersions={() => {
            setVersionEntry(detail);
            setDetail(undefined);
          }}
          key={detail.id}
          entry={detail}
          onClose={() => setDetail(undefined)}
          onSaved={reload}
        />
      ) : null}
      {tagsBatch && listing ? (
        <TagsBatchDialog
          mode={tagsBatch.mode}
          targets={tagsBatch.targets}
          limits={listing.annotationLimits}
          onClose={() => setTagsBatch(undefined)}
          onUpdated={() => {
            setTagsBatch(undefined);
            setNotice(t('files.annotations.batchDone'));
            reload();
          }}
        />
      ) : null}
      {archiveEntry ? (
        <Suspense fallback={<p role="status">{t('files.previewLoading')}</p>}>
          <ArchiveDialog
            entry={archiveEntry}
            onClose={() => setArchiveEntry(undefined)}
            onChanged={reload}
          />
        </Suspense>
      ) : null}
      {zipSelection ? (
        <Suspense fallback={<p role="status">{t('files.previewLoading')}</p>}>
          <ArchiveCreateDialog
            entries={zipSelection.entries}
            initialParent={zipSelection.parent}
            onClose={() => setZIPSelection(undefined)}
            onCreated={(task) => {
              setZIPSelection(undefined);
              setQueuedZIPName(task.sourceName);
            }}
          />
        </Suspense>
      ) : null}
      {applicationPicker ? (
        <DialogSurface
          triggerLabel={openWithLabel}
          title={openWithLabel}
          description={applicationPicker.entry.name}
          cancelLabel={t('files.close')}
          isOpen
          onOpenChange={(open) => {
            if (!open) {
              previewController.current?.abort();
              setApplicationPicker(undefined);
            }
          }}
        >
          <div className="space-y-4">
            {applicationPicker.error ? (
              <p role="alert">{applicationPicker.error}</p>
            ) : !applicationPicker.options ? (
              <p role="status">{t('files.previewLoading')}</p>
            ) : applicationPicker.options.length === 0 ? (
              <p role="status">{noApplicationLabel}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {applicationPicker.options.map((id) => (
                  <Action
                    key={id}
                    variant="secondary"
                    onPress={() => {
                      const request = previewController.current;
                      if (request && !request.signal.aborted)
                        void launchApplication(applicationPicker.entry, id, request.signal);
                    }}
                  >
                    {fileApplicationName(id, chinese)}
                  </Action>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {applicationPicker.error ? (
                <Action
                  variant="secondary"
                  onPress={() => void showPreview(applicationPicker.entry, 'choose')}
                >
                  {t('files.retry')}
                </Action>
              ) : null}
              <Action variant="secondary" onPress={() => void download(applicationPicker.entry)}>
                {t('files.download')}
              </Action>
            </div>
          </div>
        </DialogSurface>
      ) : null}
      {preview ? (
        <DialogSurface
          triggerLabel={t('files.preview')}
          title={preview.entry.name}
          description={t('files.preview')}
          cancelLabel={t('files.close')}
          isOpen
          onOpenChange={(open) => {
            if (!open) {
              previewController.current?.abort();
              setPreview(undefined);
            }
          }}
        >
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-control bg-surface-muted p-4 text-sm">
            {preview.loading ? t('files.previewLoading') : preview.text}
          </pre>
          <div className="mt-4">
            <Action
              variant="secondary"
              onPress={() => {
                void download(preview.entry);
              }}
            >
              {t('files.download')}
            </Action>
          </div>
        </DialogSurface>
      ) : null}
    </>
  );
}

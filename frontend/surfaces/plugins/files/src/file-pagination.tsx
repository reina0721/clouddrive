import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { useEffect, useRef, useState } from 'react';
import { useFiles } from '../../../src/files/runtime';

export function CursorFilePagination({
  next,
  previous,
  phase,
  count,
  onLoad,
  onPrevious,
  onRestart,
  bookmarked,
}: {
  next: boolean;
  previous: boolean;
  phase: 'ready' | 'loading' | 'retry' | 'expired';
  count: number;
  onLoad: () => void;
  onPrevious: () => void;
  onRestart: () => void;
  bookmarked: boolean;
}) {
  const { t, locale } = useFrontendTranslation();
  const chinese = locale.startsWith('zh');
  const tail = useRef<HTMLDivElement>(null);
  const { observeListEnd } = useFiles();

  useEffect(() => {
    const element = tail.current;
    if (!element || !next || phase !== 'ready') return;
    return observeListEnd(element, onLoad);
  }, [next, phase, onLoad, observeListEnd]);

  const loadedCount = chinese ? `已显示 ${count} 项` : `${count} items shown`;
  const status =
    phase === 'loading'
      ? chinese
        ? '正在加载更多文件…'
        : 'Loading more files…'
      : !next && count > 0
        ? chinese
          ? '已到列表末尾'
          : 'End of list'
        : undefined;
  return (
    <div ref={tail} className="flex flex-wrap items-center gap-3">
      {bookmarked && previous ? (
        <Action variant="secondary" size="sm" onPress={onPrevious}>
          {t('files.previousPage')}
        </Action>
      ) : null}
      <span className="text-sm text-ink-muted" role="status">
        {loadedCount}
        {status ? ` · ${status}` : ''}
      </span>
      {phase === 'retry' || phase === 'expired' ? (
        <span className="text-sm text-danger" role="alert">
          {phase === 'expired'
            ? chinese
              ? '继续加载的位置已失效，请从第一页重新浏览。'
              : 'This position expired. Start again from the first page.'
            : chinese
              ? '加载更多文件失败。'
              : 'Could not load more files.'}
        </span>
      ) : null}
      {next && phase !== 'expired' ? (
        <Action variant="secondary" size="sm" disabled={phase === 'loading'} onPress={onLoad}>
          {phase === 'retry' ? t('files.retry') : chinese ? '加载更多' : 'Load more'}
        </Action>
      ) : null}
      {bookmarked || phase === 'expired' ? (
        <Action variant="quiet" size="sm" onPress={onRestart}>
          {t('files.discovery.firstPage')}
        </Action>
      ) : null}
    </div>
  );
}

export function NumberedFilePagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const { t, locale } = useFrontendTranslation();
  const chinese = locale.startsWith('zh');
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Action
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onPress={() => onPage(Math.min(page - 1, pages))}
      >
        {t('files.previousPage')}
      </Action>
      <span className="text-sm text-ink-muted">
        {t('files.discovery.page', { current: page, pages, total })}
      </span>
      <Action
        variant="secondary"
        size="sm"
        disabled={page >= pages}
        onPress={() => onPage(page + 1)}
      >
        {t('files.nextPage')}
      </Action>
      {pages > 1 ? (
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!/^[1-9]\d*$/.test(draft) || Number(draft) > pages) {
              setInvalid(true);
              return;
            }
            setDraft('');
            setInvalid(false);
            if (Number(draft) !== page) onPage(Number(draft));
          }}
        >
          <div className="max-w-28">
            <TextField
              label={chinese ? '跳至页码' : 'Go to page'}
              inputMode="numeric"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setInvalid(false);
              }}
              {...(invalid
                ? {
                    error: chinese
                      ? `请输入 1 至 ${pages} 的整数`
                      : `Enter an integer from 1 to ${pages}`,
                  }
                : {})}
            />
          </div>
          <Action variant="secondary" size="sm" type="submit">
            {chinese ? '跳转' : 'Go'}
          </Action>
        </form>
      ) : null}
      {page > pages ? (
        <>
          <span className="text-sm text-ink-muted">{t('files.discovery.outOfRange')}</span>
          <Action variant="quiet" size="sm" onPress={() => onPage(1)}>
            {t('files.discovery.firstPage')}
          </Action>
        </>
      ) : null}
    </div>
  );
}

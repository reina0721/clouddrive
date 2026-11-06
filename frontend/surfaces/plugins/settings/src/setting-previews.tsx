import { useState } from 'react';
import { Action } from '@clouddrive/ui-adapter/action';
import { ContentSwapTransition } from '@clouddrive/ui-adapter/content-swap-transition';
import { formatTimeOfDay, useFrontendTranslation } from '@clouddrive/i18n';
import { formatInstantDate } from '@clouddrive/i18n/format';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { TOAST_DURATION_MS, type Preferences } from '@clouddrive/surface/preferences-model';

/** Static comparison sketches. Actual preferences still apply through the existing Host. */
export function DensityPreview({
  density,
}: Readonly<{ density: 'compact' | 'standard' | 'comfortable' }>) {
  const rhythm = {
    compact: 'gap-1 py-1',
    standard: 'gap-2 py-2',
    comfortable: 'gap-3 py-3',
  }[density];
  return (
    <span
      className={`flex min-h-16 flex-col justify-center rounded-control bg-surface-muted px-2 ${rhythm}`}
    >
      {[0, 1, 2].map((row) => (
        <span key={row} className="flex items-center gap-1">
          <span className="size-2 shrink-0 rounded-full bg-brand" />
          <span className="h-1 flex-1 rounded-full bg-border-strong" />
        </span>
      ))}
    </span>
  );
}

export function FontPreview({
  scale,
  sample,
}: Readonly<{ scale: 'small' | 'standard' | 'large'; sample: string }>) {
  return (
    <span
      className={`grid min-h-16 place-items-center text-ink ${scale === 'small' ? 'text-sm' : scale === 'large' ? 'text-xl' : 'text-base'}`}
    >
      {sample}
    </span>
  );
}

export function WidthPreview({ width }: Readonly<{ width: 'auto' | 'standard' | 'wide' }>) {
  return (
    <span className="flex min-h-16 items-center justify-center rounded-control bg-surface-muted p-2">
      <span
        className={`grid h-10 content-center gap-1 rounded-control border border-brand bg-brand-soft p-1 ${width === 'auto' ? 'w-full' : width === 'standard' ? 'w-2/3' : 'w-5/6'}`}
      >
        <span className="h-1 rounded-full bg-brand" />
        <span className="h-1 w-2/3 rounded-full bg-brand" />
      </span>
    </span>
  );
}

/** A real content swap and focus target; global Motion/Focus policies remain the owners. */
export function AppearanceFeedback() {
  const { t } = useFrontendTranslation();
  const [revision, setRevision] = useState(0);
  return (
    <div className="grid gap-3 border-t border-border pt-4">
      <p className="text-sm font-semibold text-ink">{t('settings.appearance.previewTitle')}</p>
      <p className="text-xs leading-5 text-ink-muted">{t('settings.appearance.previewHint')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Action onPress={() => setRevision((current) => current + 1)}>
          {t('settings.appearance.previewAction')}
        </Action>
        <span className="rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-ink-muted">
          {t('settings.appearance.previewSecondary')}
        </span>
      </div>
      <div className="min-h-16 rounded-control bg-surface-muted p-3">
        <ContentSwapTransition contentKey={String(revision)}>
          <p className="text-sm text-ink">
            {t(
              revision % 2 === 0
                ? 'settings.appearance.previewFirst'
                : 'settings.appearance.previewSecond',
            )}
          </p>
        </ContentSwapTransition>
      </div>
    </div>
  );
}

export function LongTextFeedback({ mode }: Readonly<{ mode: 'truncate' | 'wrap' }>) {
  const { t } = useFrontendTranslation();
  return (
    <div className="grid min-w-0 gap-2">
      <p className="text-xs text-ink-muted">{t('settings.dataDisplay.textPreviewHint')}</p>
      <p
        className={`max-w-sm rounded-control border border-border bg-surface-muted p-3 text-sm text-ink ${mode === 'truncate' ? 'truncate' : 'whitespace-normal wrap-break-word'}`}
        title={mode === 'truncate' ? t('settings.dataDisplay.textPreviewSample') : undefined}
      >
        {t('settings.dataDisplay.textPreviewSample')}
      </p>
    </div>
  );
}

export function LocaleFeedback({ region }: Readonly<{ region: Preferences['localeRegion'] }>) {
  const { t } = useFrontendTranslation();
  const sample = '2026-03-05T13:08:42Z';
  return (
    <div className="grid gap-2 border-t border-border pt-4">
      <p className="text-sm font-semibold text-ink">{t('settings.localeRegion.previewTitle')}</p>
      <p className="text-xs text-ink-muted">{t('settings.localeRegion.previewHint')}</p>
      <dl className="grid gap-2 text-sm text-ink">
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-ink-muted">{t('settings.localeRegion.dateFormat')}</dt>
          <dd>{formatInstantDate(region, sample)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-ink-muted">{t('settings.localeRegion.previewTime')}</dt>
          <dd>{formatTimeOfDay(region.language, region, sample)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function NotificationFeedback({
  duration,
}: Readonly<{ duration: Preferences['notifications']['toastDuration'] }>) {
  const { t } = useFrontendTranslation();
  const { notify } = useFeedback();
  const description = t('settings.notifications.previewHint', {
    count: TOAST_DURATION_MS[duration] / 1000,
  });
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Action
        variant="secondary"
        onPress={() =>
          notify({
            title: t('settings.notifications.previewTitle'),
            description,
            tone: 'success',
          })
        }
      >
        {t('settings.notifications.previewAction')}
      </Action>
      <p className="text-xs leading-5 text-ink-muted">{description}</p>
    </div>
  );
}

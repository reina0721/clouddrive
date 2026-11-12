import { useFrontendTranslation } from '@clouddrive/i18n';
import { Badge } from '@clouddrive/ui-adapter/feedback';
import { Panel } from '@clouddrive/ui-adapter/panel';
import type { ReactNode } from 'react';
import type { PreviewStateLabel } from '../i18n';
import { previewAnchor } from './preview-anchor';

export type ComponentPreviewProps = Readonly<{
  name: string;
  description: string;
  states: readonly PreviewStateLabel[];
  children: ReactNode;
  fullWidth?: boolean;
  embedded?: boolean;
}>;

export function ComponentPreview({
  name,
  description,
  states,
  children,
  fullWidth = false,
  embedded = false,
}: ComponentPreviewProps) {
  const { t } = useFrontendTranslation();
  return (
    <Panel
      appearance={embedded ? 'embedded' : 'outlined'}
      className={`min-w-0 overflow-hidden ${fullWidth ? 'lg:col-span-2' : ''}`}
    >
      <div data-reveal-item className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={previewAnchor(name)} tabIndex={-1} className="scroll-mt-24 font-bold text-ink">
            {name}
          </h3>
          <div
            aria-label={t('uiElements.previewStates', { name })}
            className="flex flex-wrap justify-end gap-1.5"
          >
            {states.map((state) => (
              <Badge key={state}>{t('uiElements.previewStateLabels.' + state)}</Badge>
            ))}
          </div>
        </div>
        <p className="mt-2 text-sm leading-6 text-ink-muted">{description}</p>
      </div>
      <div data-reveal-item className="p-4">
        {children}
      </div>
    </Panel>
  );
}

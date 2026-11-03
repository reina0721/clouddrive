'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import type { KeyValueEntry } from '@clouddrive/surface/api-workbench';
import { Action } from '@clouddrive/ui-adapter/action';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { CheckboxField, TextField } from '@clouddrive/ui-adapter/form-field';
import { Plus, Trash2 } from 'lucide-react';
export type KeyValueEditorProps = Readonly<{
  entries: readonly KeyValueEntry[];
  onChange: (entries: readonly KeyValueEntry[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  showDescription?: boolean;
}>;
export function KeyValueEditor({
  entries,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  showDescription = false,
}: KeyValueEditorProps) {
  const { t } = useFrontendTranslation();
  const update = (id: string, patch: Partial<KeyValueEntry>) =>
    onChange(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  return (
    <div className="@container/editor grid min-w-0 gap-3">
      {entries.length === 0 && (
        <p className="py-6 text-sm leading-6 text-ink-muted">{t('apiWorkbench.keyValues.empty')}</p>
      )}
      <div className="min-w-0 divide-y divide-border">
        {entries.map((entry) => (
          <div key={entry.id} className="grid min-w-0 grid-cols-12 items-end gap-3 py-4 first:pt-0">
            <div className="col-span-10 min-w-0 @3xl/editor:col-span-2">
              <CheckboxField
                checked={entry.enabled}
                onCheckedChange={(enabled) => update(entry.id, { enabled })}
                label={t('apiWorkbench.keyValues.enabled')}
              />
            </div>
            <div className="col-span-2 justify-self-end @3xl/editor:order-last @3xl/editor:col-span-1">
              <IconAction
                label={t('apiWorkbench.keyValues.delete')}
                onPress={() => onChange(entries.filter((item) => item.id !== entry.id))}
                size="sm"
              >
                <Trash2 className="size-4 text-danger" />
              </IconAction>
            </div>
            <div
              className={`col-span-12 grid min-w-0 gap-3 @lg/editor:grid-cols-2 @3xl/editor:col-span-9 ${showDescription ? '@3xl/editor:grid-cols-3' : ''}`}
            >
              <TextField
                label={t('apiWorkbench.keyValues.key')}
                {...(keyPlaceholder ? { placeholder: keyPlaceholder } : {})}
                value={entry.key}
                onChange={(event) => update(entry.id, { key: event.target.value })}
              />
              <TextField
                label={t('apiWorkbench.keyValues.value')}
                {...(valuePlaceholder ? { placeholder: valuePlaceholder } : {})}
                value={entry.value}
                onChange={(event) => update(entry.id, { value: event.target.value })}
              />
              {showDescription && (
                <div className="min-w-0 @lg/editor:col-span-2 @3xl/editor:col-span-1">
                  <TextField
                    label={t('apiWorkbench.keyValues.description')}
                    value={entry.description ?? ''}
                    onChange={(event) => update(entry.id, { description: event.target.value })}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div>
        <Action
          variant="secondary"
          size="sm"
          leadingIcon={<Plus className="size-4" />}
          onPress={() =>
            onChange([
              ...entries,
              {
                id: `kv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
                key: '',
                value: '',
                enabled: true,
                ...(showDescription ? { description: '' } : {}),
              },
            ])
          }
        >
          {t('apiWorkbench.keyValues.add')}
        </Action>
      </div>
    </div>
  );
}

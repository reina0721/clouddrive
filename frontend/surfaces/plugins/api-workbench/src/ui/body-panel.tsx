'use client';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import type { RequestBody } from '@clouddrive/surface/api-workbench';
import { Action } from '@clouddrive/ui-adapter/action';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { SelectField, TextAreaField } from '@clouddrive/ui-adapter/form-field';
import { KeyValueEditor } from './key-value-editor';
export type BodyPanelProps = Readonly<{ body: RequestBody; onChange: (body: RequestBody) => void }>;
const bodyTypes: readonly RequestBody['type'][] = [
  'none',
  'json',
  'text',
  'xml',
  'form-urlencoded',
  'form-data',
];
const isText = (type: RequestBody['type']) => type === 'json' || type === 'text' || type === 'xml';
const isForm = (type: RequestBody['type']) => type === 'form-urlencoded' || type === 'form-data';
export function BodyPanel({ body, onChange }: BodyPanelProps) {
  const { t } = useFrontendTranslation();
  const [invalid, setInvalid] = useState(false);
  const [pendingType, setPendingType] = useState<RequestBody['type'] | null>(null);
  const applyType = (type: RequestBody['type']) => {
    setInvalid(false);
    if (type === 'json' || type === 'text' || type === 'xml')
      onChange({ type, content: 'content' in body ? body.content : '' });
    else if (type === 'form-urlencoded' || type === 'form-data')
      onChange({ type, entries: 'entries' in body ? body.entries : [] });
    else onChange({ type: 'none' });
  };
  return (
    <div className="@container/editor grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-3 @lg/editor:grid-cols-2 items-end">
        <SelectField
          label={t('apiWorkbench.body.type')}
          value={body.type}
          options={bodyTypes.map((type) => ({
            value: type,
            label: t(
              `apiWorkbench.body.${type === 'form-urlencoded' ? 'formUrlencoded' : type === 'form-data' ? 'formData' : type}`,
            ),
          }))}
          onValueChange={(value) => {
            const next = bodyTypes.find((type) => type === value);
            if (!next || next === body.type) return;
            const hasContent =
              ('content' in body && body.content.trim().length > 0) ||
              ('entries' in body && body.entries.length > 0);
            if (
              hasContent &&
              !((isText(next) && isText(body.type)) || (isForm(next) && isForm(body.type)))
            )
              setPendingType(next);
            else applyType(next);
          }}
        />
        {body.type === 'json' && (
          <div>
            <Action
              variant="secondary"
              onPress={() => {
                try {
                  const parsed: unknown = JSON.parse(body.content);
                  onChange({ ...body, content: JSON.stringify(parsed, null, 2) });
                  setInvalid(false);
                } catch {
                  setInvalid(true);
                }
              }}
            >
              {t('apiWorkbench.body.prettify')}
            </Action>
          </div>
        )}
      </div>
      {'content' in body && (
        <TextAreaField
          label={t('apiWorkbench.body.content')}
          content="code"
          rows={12}
          placeholder={t('apiWorkbench.body.placeholder')}
          value={body.content}
          {...(invalid ? { error: t('apiWorkbench.body.invalidJson') } : {})}
          onChange={(event) => {
            setInvalid(false);
            onChange({ ...body, content: event.target.value });
          }}
        />
      )}
      {'entries' in body && (
        <KeyValueEditor
          entries={body.entries}
          onChange={(entries) => onChange({ ...body, entries })}
        />
      )}
      <ConfirmDialog
        isOpen={pendingType !== null}
        onOpenChange={(open) => {
          if (!open) setPendingType(null);
        }}
        triggerLabel={t('apiWorkbench.body.changeTitle')}
        title={t('apiWorkbench.body.changeTitle')}
        description={t('apiWorkbench.body.changeDescription')}
        impact={t('apiWorkbench.common.deleteOneImpact')}
        cancelLabel={t('apiWorkbench.common.cancel')}
        confirmLabel={t('apiWorkbench.body.changeConfirm')}
        failureMessage={t('apiWorkbench.common.failed')}
        onConfirm={() => {
          if (pendingType) applyType(pendingType);
          setPendingType(null);
        }}
      />
    </div>
  );
}

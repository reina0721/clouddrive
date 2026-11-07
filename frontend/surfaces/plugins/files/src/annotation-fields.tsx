'use client';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField, TextField, TextAreaField } from '@clouddrive/ui-adapter/form-field';
import { ManagedPropertyInput } from '../../../src/files/managed-property-input';
import {
  initialManagedPropertyValue,
  type PropertyDefinition,
} from '../../../src/files/property-definitions';
import {
  annotationColorSchema,
  annotationTagNamesSchema,
  fileAnnotationLimits,
  type FileAnnotationTag,
  type FileAnnotationValues,
} from '../../../src/files/annotation-values';

export function AnnotationColorDot({ color }: { color: string }) {
  const parsed = annotationColorSchema.safeParse(color);
  return (
    <span
      aria-hidden="true"
      className="inline-block size-3 shrink-0 rounded-full border border-border-strong"
      style={parsed.success ? { backgroundColor: parsed.data } : undefined}
    />
  );
}

export function TagNamesInput({
  value,
  onChange,
  disabled = false,
}: {
  value: readonly string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useFrontendTranslation(),
    [input, setInput] = useState(''),
    [invalid, setInvalid] = useState(false);
  return (
    <div className="space-y-2">
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = annotationTagNamesSchema.safeParse([...value, input]);
          if (!parsed.success) {
            setInvalid(true);
            return;
          }
          onChange(parsed.data);
          setInput('');
          setInvalid(false);
        }}
      >
        <TextField
          label={t('files.annotations.tagNames')}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={disabled}
          hint={t('files.annotations.tagInput')}
        />
        <Action
          type="submit"
          variant="secondary"
          disabled={disabled || value.length >= fileAnnotationLimits.tags || !input.trim()}
        >
          {t('files.annotations.add')}
        </Action>
      </form>
      {invalid ? (
        <p role="alert" className="text-sm text-danger">
          {t('files.annotations.invalid')}
        </p>
      ) : null}
      <ul className="flex flex-wrap gap-2">
        {value.map((name, index) => (
          <li key={index} className="min-w-0 max-w-full">
            <Action
              size="sm"
              variant="secondary"
              disabled={disabled}
              onPress={() => onChange(value.filter((_, position) => position !== index))}
            >
              <span className="block max-w-44 truncate" title={name}>
                {t('files.annotations.remove', { name })}
              </span>
            </Action>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TagsEditor({
  value,
  onChange,
  defaultColor,
  maxTags,
  disabled = false,
}: {
  value: readonly FileAnnotationTag[];
  onChange: (value: FileAnnotationTag[]) => void;
  defaultColor: string;
  maxTags: number;
  disabled?: boolean;
}) {
  const { t } = useFrontendTranslation();
  const edit = (index: number, change: Partial<FileAnnotationTag>) =>
    onChange(value.map((tag, position) => (position === index ? { ...tag, ...change } : tag)));
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 font-semibold">{t('files.annotations.tags')}</legend>
      {value.length ? (
        value.map((tag, index) => (
          <div key={index} className="space-y-2 rounded-control border border-border p-3">
            <TextField
              label={t('files.annotations.tagName', { index: index + 1 })}
              value={tag.name}
              disabled={disabled}
              onChange={(event) => edit(index, { name: event.target.value })}
            />
            <div className="flex items-end gap-3">
              <TextField
                label={t('files.annotations.tagColor', { index: index + 1 })}
                value={tag.color}
                disabled={disabled}
                onChange={(event) => edit(index, { color: event.target.value })}
                hint={t('files.annotations.colorHint')}
              />
              <AnnotationColorDot color={tag.color} />
            </div>
            <Action
              size="sm"
              variant="quiet"
              disabled={disabled}
              onPress={() => onChange(value.filter((_, position) => position !== index))}
            >
              {t('files.annotations.removeTag', { name: tag.name || String(index + 1) })}
            </Action>
          </div>
        ))
      ) : (
        <p className="text-sm text-ink-muted">{t('files.annotations.noTags')}</p>
      )}
      <Action
        size="sm"
        variant="secondary"
        disabled={disabled || value.length >= maxTags}
        onPress={() => onChange([...value, { name: '', color: defaultColor }])}
      >
        {t('files.annotations.addTag')}
      </Action>
    </fieldset>
  );
}

export function PropertiesEditor({
  value,
  onChange,
  maxProperties,
  definitions = [],
  existing = [],
  disabled = false,
}: {
  value: FileAnnotationValues['properties'];
  onChange: (value: FileAnnotationValues['properties']) => void;
  maxProperties: number;
  definitions?: readonly PropertyDefinition[];
  existing?: FileAnnotationValues['properties'];
  disabled?: boolean;
}) {
  const { t, locale } = useFrontendTranslation();
  const chinese = locale.startsWith('zh');
  const [chosenKey, setChosenKey] = useState('');
  const available = definitions.filter(
    (definition) => !value.some((property) => property.key === definition.key),
  );
  const chosen = available.find((definition) => definition.key === chosenKey);
  const edit = (index: number, change: Partial<FileAnnotationValues['properties'][number]>) =>
    onChange(value.map((item, position) => (position === index ? { ...item, ...change } : item)));
  const canAdd = !disabled && value.length < maxProperties;
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 font-semibold">{t('files.annotations.properties')}</legend>
      <p className="text-xs text-ink-muted">{t('files.annotations.propertyHint')}</p>
      {value.map((property, index) => {
        const definition = definitions.find((candidate) => candidate.key === property.key);
        const preserveExisting = existing.some(
          (item) => item.key === property.key && item.value === property.value,
        );
        return (
          <div key={index} className="space-y-2 rounded-control border border-border p-3">
            {definition ? (
              <>
                <p className="break-all text-xs text-ink-muted">{definition.key}</p>
                <ManagedPropertyInput
                  definition={definition}
                  label={definition.name}
                  value={property.value}
                  disabled={disabled}
                  preserveExisting={preserveExisting}
                  onChange={(next) => edit(index, { value: next })}
                />
              </>
            ) : (
              <>
                <TextField
                  label={t('files.annotations.propertyKey', {
                    index: index + 1,
                  })}
                  value={property.key}
                  disabled={disabled}
                  onChange={(event) => edit(index, { key: event.target.value })}
                />
                <TextAreaField
                  label={t('files.annotations.propertyValue', {
                    index: index + 1,
                  })}
                  value={property.value}
                  disabled={disabled}
                  rows={2}
                  onChange={(event) => edit(index, { value: event.target.value })}
                />
              </>
            )}
            <Action
              size="sm"
              variant="quiet"
              disabled={disabled}
              onPress={() => onChange(value.filter((_, position) => position !== index))}
            >
              {t('files.annotations.removeProperty', {
                key: property.key || String(index + 1),
              })}
            </Action>
          </div>
        );
      })}
      {available.length > 0 ? (
        <div className="min-w-0 space-y-2">
          <SelectField
            label={chinese ? '全局属性' : 'Defined property'}
            value={chosen?.key ?? null}
            options={available.map((definition) => ({
              value: definition.key,
              label: definition.name,
            }))}
            disabled={!canAdd}
            onValueChange={setChosenKey}
          />
          <Action
            size="sm"
            variant="secondary"
            disabled={!canAdd || !chosen}
            onPress={() => {
              if (!chosen) return;
              onChange([...value, { key: chosen.key, value: initialManagedPropertyValue(chosen) }]);
              setChosenKey('');
            }}
          >
            {chinese ? '添加已定义属性' : 'Add defined property'}
          </Action>
        </div>
      ) : null}
      <Action
        size="sm"
        variant="secondary"
        disabled={!canAdd}
        onPress={() => onChange([...value, { key: '', value: '' }])}
      >
        {t('files.annotations.addProperty')}
      </Action>
    </fieldset>
  );
}

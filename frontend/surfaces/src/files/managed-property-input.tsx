'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import {
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
} from '@clouddrive/ui-adapter/form-field';
import {
  defaultPropertyRating,
  parsePropertyChoices,
  validateManagedProperty,
  type PropertyDefinition,
} from './property-definitions';

export function ManagedPropertyInput({
  definition,
  label,
  value,
  onChange,
  disabled = false,
  preserveExisting = false,
}: {
  definition: PropertyDefinition;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  preserveExisting?: boolean;
}) {
  const { locale } = useFrontendTranslation();
  const chinese = locale.startsWith('zh');
  const invalid = value !== '' && !validateManagedProperty(definition, value);
  const hint =
    preserveExisting && invalid
      ? chinese
        ? '现有值将保留，修改后须符合当前规则。'
        : 'The existing value is kept until you edit it.'
      : undefined;
  if (definition.kind === 'multi-select') {
    const options = definition.options ?? [];
    const selected = (parsePropertyChoices(value) ?? []).filter((option) =>
      options.includes(option),
    );
    return (
      <fieldset className="min-w-0 space-y-2">
        <legend className="font-semibold">{label}</legend>
        {hint ? (
          <p className="break-all text-sm text-ink-muted">
            {hint} {value}
          </p>
        ) : null}
        {options.map((option) => (
          <CheckboxField
            key={option}
            label={option}
            checked={selected.includes(option)}
            disabled={disabled}
            onCheckedChange={(checked) => {
              const next = new Set(selected);
              if (checked) next.add(option);
              else next.delete(option);
              onChange(JSON.stringify(options.filter((candidate) => next.has(candidate))));
            }}
          />
        ))}
      </fieldset>
    );
  }
  if (
    definition.kind === 'checkbox' ||
    definition.kind === 'select' ||
    definition.kind === 'rating'
  ) {
    let values: { value: string; label: string }[];
    switch (definition.kind) {
      case 'checkbox':
        values = [
          { value: 'true', label: chinese ? '是' : 'Yes' },
          { value: 'false', label: chinese ? '否' : 'No' },
        ];
        break;
      case 'rating':
        values = Array.from({ length: definition.maximum ?? defaultPropertyRating }, (_, index) => {
          const stars = String(index + 1);
          return {
            value: stars,
            label: chinese ? stars + ' 星' : stars + (index === 0 ? ' star' : ' stars'),
          };
        });
        break;
      default:
        values = (definition.options ?? []).map((option) => ({
          value: option,
          label: option,
        }));
    }
    return (
      <SelectField
        label={label}
        value={values.some((option) => option.value === value) ? value : null}
        options={values}
        disabled={disabled}
        placeholder={chinese ? '请选择' : 'Select a value'}
        {...(hint ? { hint: hint + ' ' + value } : {})}
        onValueChange={onChange}
      />
    );
  }
  if (definition.kind === 'text') {
    return (
      <TextAreaField
        label={label}
        rows={2}
        value={value}
        disabled={disabled}
        {...(hint ? { hint } : {})}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <TextField
      label={label}
      value={value}
      disabled={disabled}
      {...(hint ? { hint } : {})}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

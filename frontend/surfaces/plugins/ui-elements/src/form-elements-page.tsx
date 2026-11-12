'use client';

import type { DatePickerFieldProps } from '@clouddrive/ui-adapter/date-picker-field';
import type { ComponentType, ReactNode } from 'react';
import {
  CheckboxField,
  ComboField,
  RadioGroupField,
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
  PasswordField,
} from '@clouddrive/ui-adapter/form-field';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { RangeSlider } from '@clouddrive/ui-adapter/range-slider';
import { FormErrorSummary } from '@clouddrive/ui-adapter/form-error-summary';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Section } from '@clouddrive/surface-foundation/layout';
import { ComponentPreview } from './component-preview';
import { UiElementsFamilyPage } from './family-page';
import { Eye, EyeOff, Compass, Sparkles } from 'lucide-react';

const ownerOptions = [
  'Lin Chen',
  'Avery Morgan',
  'Mika Sato',
  'Noah Williams',
  'Sofia Rossi',
  'Amara Okafor',
  'Mateo Garcia',
  'Lea Dubois',
  'Omar Haddad',
  'Priya Shah',
  'Jonas Berg',
  'Nora Jensen',
  'Kai Müller',
  'Mei Tanaka',
] as const;
function ExecutionSketch({ step, icon }: Readonly<{ step: number; icon: ReactNode }>) {
  return (
    <span className="grid min-h-16 w-full content-center gap-2 rounded-control bg-surface-muted p-2">
      <span className="text-brand">{icon}</span>
      <span className="flex gap-1">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={`h-2 flex-1 rounded-full ${index <= step ? 'bg-brand' : 'bg-border-strong'}`}
          />
        ))}
      </span>
    </span>
  );
}

export function FormElementsPage({
  datePicker: DatePickerField,
}: Readonly<{ datePicker: ComponentType<DatePickerFieldProps> }>) {
  const { t } = useFrontendTranslation();
  const searchParams = useSearchParams();
  const overlay = searchParams.get('overlay');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [checked, setChecked] = useState(true);
  const [selected, setSelected] = useState('guided');
  const [searchValue, setSearchValue] = useState('UI');
  const [rangeValue, setRangeValue] = useState(50);
  const visibilityIcons = {
    show: <Eye aria-hidden="true" className="size-4" />,
    hide: <EyeOff aria-hidden="true" className="size-4" />,
  };
  return (
    <UiElementsFamilyPage
      familyId="forms"
      title={t('uiElements.fieldsTitle')}
      description={t('uiElements.fieldsDescription')}
    >
      {({ description, longText, setLongText, spacing }) => (
        <>
          <Section
            id="forms"
            title={t('uiElements.fieldsTitle')}
            description={t('uiElements.fieldsDescription')}
          >
            <div className={`grid p-5 lg:grid-cols-2 ${spacing}`}>
              <ComponentPreview
                fullWidth
                name="TextField · Control only"
                description={t('uiElements.controlOnlyFieldHint')}
                states={['Accessible label', 'Keyboard', 'Toolbar']}
              >
                <div className="w-24">
                  <TextField
                    label={t('uiElements.controlOnlyField')}
                    presentation="control-only"
                    inputMode="numeric"
                    defaultValue="12"
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                fullWidth
                name="TextField"
                description={t('uiElements.catalog.textFieldDescription')}
                states={['Default', 'Hint', 'Invalid', 'Disabled', 'Placeholder', 'Long content']}
              >
                <div className="surface-filter-grid">
                  <TextField
                    label={t('uiElements.textField')}
                    hint={t('uiElements.fieldHint')}
                    placeholder={t('uiElements.placeholder')}
                  />
                  <TextField
                    label={t('uiElements.errorField')}
                    error={t('uiElements.errorMessage')}
                    defaultValue="x"
                  />
                  <TextField
                    label={t('uiElements.decimalField')}
                    inputMode="decimal"
                    defaultValue="1.5"
                  />
                  <TextField
                    label={t('uiElements.disabledField')}
                    disabled
                    defaultValue="readonly"
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                fullWidth
                name="PasswordField"
                description={t('uiElements.passwordDescription')}
                states={['Default', 'Visible', 'Invalid', 'Disabled', 'Keyboard', 'Autocomplete']}
              >
                <div className="surface-filter-grid">
                  <PasswordField
                    label={t('uiElements.password')}
                    visibilityIcons={visibilityIcons}
                    purpose="current"
                    hint={t('uiElements.fieldHint')}
                    showLabel={t('uiElements.showPassword')}
                    hideLabel={t('uiElements.hidePassword')}
                  />
                  <PasswordField
                    label={t('uiElements.errorField')}
                    purpose="new"
                    visibilityIcons={visibilityIcons}
                    error={t('uiElements.errorMessage')}
                    showLabel={t('uiElements.showPassword')}
                    hideLabel={t('uiElements.hidePassword')}
                  />
                  <PasswordField
                    label={t('uiElements.disabledField')}
                    purpose="current"
                    visibilityIcons={visibilityIcons}
                    disabled
                    showLabel={t('uiElements.showPassword')}
                    hideLabel={t('uiElements.hidePassword')}
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="TextAreaField"
                description={t('uiElements.catalog.textAreaDescription')}
                states={[
                  'Default',
                  'Hint / error',
                  'Disabled',
                  'Rows',
                  'Resize',
                  'Long content',
                  'Code',
                ]}
              >
                <div className="grid gap-3">
                  <TextAreaField
                    label={t('uiElements.textArea')}
                    hint={t('uiElements.fieldHint')}
                    defaultValue={description}
                  />
                  <TextAreaField
                    content="code"
                    label={`${t('uiElements.textArea')} (Code / JSON)`}
                    defaultValue={'{\n  "status": 200,\n  "data": { "ok": true }\n}'}
                    rows={3}
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="SearchBox"
                description={t('uiElements.catalog.searchBoxDescription')}
                states={['Value', 'Clear', 'Disabled', 'Accessible label']}
              >
                <div className="grid gap-3">
                  <SearchBox
                    label={t('uiElements.searchLabel')}
                    placeholder={t('uiElements.searchPlaceholder')}
                    value={searchValue}
                    onValueChange={setSearchValue}
                  />
                  <SearchBox
                    disabled
                    label={t('uiElements.catalog.disabledSearch')}
                    placeholder={t('uiElements.searchPlaceholder')}
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="SelectField"
                description={t('uiElements.catalog.selectDescription')}
                states={[
                  'Selected',
                  'Disabled option',
                  'Disabled field',
                  'Popup scroll',
                  'Keyboard',
                ]}
              >
                <div className="grid gap-3">
                  <SelectField
                    label={t('uiElements.select')}
                    hint={t('uiElements.selectionOverlayHint')}
                    defaultOpen={overlay === 'select'}
                    options={[
                      { value: 'observe', label: t('uiElements.formDemo.observe') },
                      { value: 'guided', label: t('uiElements.formDemo.guided') },
                      {
                        value: 'automatic',
                        label: t('uiElements.formDemo.automatic'),
                        disabled: true,
                      },
                      ...Array.from({ length: 12 }, (_, index) => ({
                        value: `queue-${index + 1}`,
                        label: t('uiElements.queueOption', { number: index + 1 }),
                      })),
                    ]}
                    value={selected}
                    onValueChange={setSelected}
                  />
                  <div className="w-60 max-w-full">
                    <SelectField
                      presentation="toolbar"
                      label={t('uiElements.toolbarSelect')}
                      defaultValue="long"
                      options={[
                        { value: 'long', label: t('uiElements.longSelectChoice') },
                        { value: 'observe', label: t('uiElements.formDemo.observe') },
                      ]}
                    />
                  </div>
                  <SelectField
                    disabled
                    label={t('uiElements.disabledField')}
                    options={[{ value: 'guided', label: t('uiElements.formDemo.guided') }]}
                    value="guided"
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="ComboField"
                description={t('uiElements.catalog.comboDescription')}
                states={['Filter', 'Selected', 'Disabled option', 'Disabled field', 'Popup scroll']}
              >
                <div className="grid gap-3">
                  <ComboField
                    label={t('uiElements.combobox')}
                    hint={t('uiElements.selectionOverlayHint')}
                    placeholder={t('uiElements.comboboxPlaceholder')}
                    options={ownerOptions.map((owner) => ({
                      value: owner,
                      label: owner,
                      disabled: owner === 'Omar Haddad',
                    }))}
                  />
                  <ComboField
                    disabled
                    label={t('uiElements.disabledField')}
                    placeholder={t('uiElements.comboboxPlaceholder')}
                    options={[]}
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="DatePickerField"
                description={t('uiElements.catalog.dateDescription')}
                states={['Segments', 'Popup', 'Selected date', 'Disabled', 'Keyboard']}
              >
                <div className="grid gap-3">
                  <DatePickerField
                    label={t('uiElements.datePicker')}
                    value={selectedDate}
                    onValueChange={setSelectedDate}
                    hint={t('uiElements.overlayHint')}
                    calendarLabel={t('uiElements.formDemo.calendarLabel')}
                    defaultOpen={overlay === 'date'}
                  />
                  <DatePickerField
                    disabled
                    label={t('uiElements.disabledField')}
                    calendarLabel={t('uiElements.formDemo.calendarLabel')}
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="CheckboxField"
                description={t('uiElements.catalog.checkboxDescription')}
                states={['Selected', 'Unselected', 'Description', 'Disabled']}
              >
                <div className="grid gap-3">
                  <CheckboxField
                    label={t('uiElements.checkbox')}
                    description={t('uiElements.checkboxDescription')}
                    checked={checked}
                    onCheckedChange={setChecked}
                  />
                  <CheckboxField
                    label={t('uiElements.disabledCheckbox')}
                    checked={false}
                    disabled
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="RadioGroupField"
                description={t('uiElements.catalog.radioDescription')}
                states={['Selected', 'Disabled option', 'Hint / error', 'Keyboard']}
              >
                <RadioGroupField
                  label={t('uiElements.radioGroup')}
                  options={[
                    { value: 'observe', label: t('uiElements.formDemo.observe') },
                    { value: 'guided', label: t('uiElements.formDemo.guided') },
                    {
                      value: 'automatic',
                      label: t('uiElements.formDemo.automatic'),
                      disabled: true,
                    },
                  ]}
                  value={selected}
                  onValueChange={setSelected}
                />
                <RadioGroupField
                  presentation="tiles"
                  label={t('uiElements.radioTiles')}
                  labelIcon={<Sparkles className="size-5" />}
                  hint={t('uiElements.catalog.radioDescription')}
                  options={[
                    {
                      value: 'observe',
                      label: t('uiElements.formDemo.observe'),
                      icon: <Eye className="size-5" />,
                    },
                    {
                      value: 'guided',
                      label: t('uiElements.formDemo.guided'),
                      icon: <Compass className="size-5" />,
                    },
                    {
                      value: 'automatic',
                      label: t('uiElements.formDemo.automatic'),
                      icon: <Sparkles className="size-5" />,
                      disabled: true,
                    },
                  ]}
                  value={selected}
                  onValueChange={setSelected}
                />
                <RadioGroupField
                  presentation="inline"
                  label={t('uiElements.radioInline')}
                  options={[
                    {
                      value: 'observe',
                      label: longText
                        ? t('uiElements.longChoice', { label: t('uiElements.formDemo.observe') })
                        : t('uiElements.formDemo.observe'),
                    },
                    {
                      value: 'guided',
                      label: longText
                        ? t('uiElements.longChoice', { label: t('uiElements.formDemo.guided') })
                        : t('uiElements.formDemo.guided'),
                    },
                    {
                      value: 'automatic',
                      label: longText
                        ? t('uiElements.longChoice', { label: t('uiElements.formDemo.automatic') })
                        : t('uiElements.formDemo.automatic'),
                      disabled: true,
                    },
                  ]}
                  value={selected}
                  onValueChange={setSelected}
                />
                <RadioGroupField
                  presentation="previews"
                  label={t('uiElements.radioPreviews')}
                  hint={longText ? description : t('uiElements.catalog.radioDescription')}
                  options={[
                    {
                      value: 'observe',
                      label: longText
                        ? t('uiElements.longChoice', { label: t('uiElements.formDemo.observe') })
                        : t('uiElements.formDemo.observe'),
                      preview: <ExecutionSketch step={0} icon={<Eye className="size-5" />} />,
                    },
                    {
                      value: 'guided',
                      label: longText
                        ? t('uiElements.longChoice', { label: t('uiElements.formDemo.guided') })
                        : t('uiElements.formDemo.guided'),
                      preview: <ExecutionSketch step={1} icon={<Compass className="size-5" />} />,
                    },
                    {
                      value: 'automatic',
                      label: longText
                        ? t('uiElements.longChoice', { label: t('uiElements.formDemo.automatic') })
                        : t('uiElements.formDemo.automatic'),
                      preview: <ExecutionSketch step={2} icon={<Sparkles className="size-5" />} />,
                      disabled: true,
                    },
                  ]}
                  value={selected}
                  onValueChange={setSelected}
                />
              </ComponentPreview>
              <ComponentPreview
                name="SwitchField"
                description={t('uiElements.catalog.switchDescription')}
                states={['On', 'Off', 'Disabled', 'Description']}
              >
                <div className="grid gap-3">
                  <SwitchField
                    label={t('uiElements.longText')}
                    description={t('uiElements.longTextDescription')}
                    checked={longText}
                    onCheckedChange={setLongText}
                  />
                  <SwitchField
                    disabled
                    label={t('uiElements.disabled')}
                    description={t('uiElements.catalog.disabledControlDescription')}
                    checked={false}
                    onCheckedChange={() => undefined}
                  />
                  <SwitchField
                    presentation="row"
                    label={t('uiElements.formDemo.switchRow')}
                    description={t('uiElements.longTextDescription')}
                    checked={longText}
                    onCheckedChange={setLongText}
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                fullWidth
                name="FormErrorSummary"
                description={t('uiElements.additional.errorSummary')}
                states={['Empty', 'Multiple errors', 'Focus recovery', 'Live alert']}
              >
                <FormErrorSummary
                  errors={[
                    {
                      fieldId: 'name',
                      label: t('uiElements.formDemo.name'),
                      message: t('uiElements.formDemo.nameError'),
                    },
                    {
                      fieldId: 'owner',
                      label: t('uiElements.formDemo.owner'),
                      message: t('uiElements.formDemo.ownerError'),
                    },
                  ]}
                  title={t('uiElements.additional.correctFields')}
                />
              </ComponentPreview>
              <ComponentPreview
                name="RangeSlider"
                description={t('uiElements.rangeDescription')}
                states={['Pointer', 'Keyboard', 'Disabled']}
              >
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <p>{t('uiElements.rangeValue', { value: rangeValue })}</p>
                    <RangeSlider
                      label={t('uiElements.rangeLabel')}
                      value={rangeValue}
                      max={100}
                      onValueChange={setRangeValue}
                    />
                  </div>
                  <RangeSlider
                    label={t('uiElements.disabledField')}
                    value={25}
                    max={100}
                    disabled
                    onValueChange={setRangeValue}
                  />
                </div>
              </ComponentPreview>
            </div>
          </Section>
        </>
      )}
    </UiElementsFamilyPage>
  );
}

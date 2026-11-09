import type { ReactNode } from 'react';

export { type TextFieldProps, TextField } from './text-field';

export function HiddenField({ name, value }: { name: string; value: string | number }) {
  return <input type="hidden" name={name} value={value} />;
}
export { type PasswordFieldProps, PasswordField } from './password-field';
export { type TextAreaFieldProps, TextAreaField } from './text-area-field';
export { type SelectOption, type SelectFieldProps, SelectField } from './select-field';
export { type ComboFieldProps, ComboField } from './combo-field';
export { type SwitchFieldProps, SwitchField } from './switch-field';
export { type CheckboxFieldProps, CheckboxField } from './checkbox-field';
export { type RadioOption, type RadioGroupFieldProps, RadioGroupField } from './radio-group-field';

export type FieldLabelProps = Readonly<{ children: ReactNode }>;

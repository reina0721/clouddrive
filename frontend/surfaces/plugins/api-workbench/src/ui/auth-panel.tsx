'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import type { RequestAuth } from '@clouddrive/surface/api-workbench';
import {
  SelectField,
  type SelectOption,
  TextField,
  PasswordField,
} from '@clouddrive/ui-adapter/form-field';

export type AuthPanelProps = Readonly<{
  auth: RequestAuth;
  onChange: (auth: RequestAuth) => void;
}>;

export function AuthPanel({ auth, onChange }: AuthPanelProps) {
  const { t } = useFrontendTranslation();

  const authOptions: readonly SelectOption[] = [
    { value: 'none', label: t('apiWorkbench.auth.none') },
    { value: 'bearer', label: t('apiWorkbench.auth.bearer') },
    { value: 'basic', label: t('apiWorkbench.auth.basic') },
    { value: 'api-key', label: t('apiWorkbench.auth.apiKey') },
  ];

  const handleTypeChange = (typeId: string) => {
    if (typeId === 'bearer') {
      onChange({ type: 'bearer', token: '' });
    } else if (typeId === 'basic') {
      onChange({ type: 'basic', username: '', password: '' });
    } else if (typeId === 'api-key') {
      onChange({ type: 'api-key', key: '', value: '', in: 'header' });
    } else {
      onChange({ type: 'none' });
    }
  };

  return (
    <div className="@container/editor grid min-w-0 gap-4">
      <SelectField
        label={t('apiWorkbench.auth.type')}
        options={authOptions}
        value={auth.type}
        onValueChange={(id: string) => handleTypeChange(id)}
      />

      {auth.type === 'bearer' && (
        <TextField
          label={t('apiWorkbench.auth.token')}
          placeholder="eyJhbGciOi..."
          value={auth.token}
          onChange={(e) => onChange({ ...auth, token: e.target.value })}
        />
      )}

      {auth.type === 'basic' && (
        <div className="grid gap-3 @lg/editor:grid-cols-2">
          <TextField
            label={t('apiWorkbench.auth.username')}
            value={auth.username}
            onChange={(e) => onChange({ ...auth, username: e.target.value })}
          />
          <PasswordField
            purpose="current"
            showLabel={t('apiWorkbench.common.showPassword')}
            hideLabel={t('apiWorkbench.common.hidePassword')}
            label={t('apiWorkbench.auth.password')}
            value={auth.password}
            onChange={(e) => onChange({ ...auth, password: e.target.value })}
          />
        </div>
      )}

      {auth.type === 'api-key' && (
        <div className="grid gap-3">
          <div className="grid gap-3 @lg/editor:grid-cols-2">
            <TextField
              label={t('apiWorkbench.auth.key')}
              placeholder="X-API-Key"
              value={auth.key}
              onChange={(e) => onChange({ ...auth, key: e.target.value })}
            />
            <TextField
              label={t('apiWorkbench.auth.value')}
              value={auth.value}
              onChange={(e) => onChange({ ...auth, value: e.target.value })}
            />
          </div>
          <SelectField
            label={t('apiWorkbench.auth.addTo')}
            options={[
              { value: 'header', label: t('apiWorkbench.auth.header') },
              { value: 'query', label: t('apiWorkbench.auth.query') },
            ]}
            value={auth.in}
            onValueChange={(id: string) =>
              onChange({ ...auth, in: id === 'query' ? 'query' : 'header' })
            }
          />
        </div>
      )}
    </div>
  );
}

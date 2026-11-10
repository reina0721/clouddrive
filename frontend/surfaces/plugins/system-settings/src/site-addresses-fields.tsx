'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { Section } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import {
  maxSiteAlternatives,
  normalizeSiteOrigin,
  type SiteAddresses,
} from '../../../src/administration/site-profile';

export function SiteAddressesFields({
  value,
  onChange,
  allowed,
  disabled,
  invalid,
}: Readonly<{
  value: SiteAddresses | undefined;
  onChange: (addresses: SiteAddresses) => void;
  allowed: readonly string[];
  disabled: boolean;
  invalid: boolean;
}>) {
  const { t } = useFrontendTranslation();
  const label = (key: string, index?: number) => t('systemSettings.site.' + key, { index });
  const primary = value?.primary ?? '';
  const alternatives = value?.alternatives ?? [];
  function warning(address: string) {
    const origin = normalizeSiteOrigin(address);
    return origin && !allowed.includes(origin) ? label('origin-not-allowed') : undefined;
  }
  function edit(index: number, address: string) {
    onChange({
      primary,
      alternatives: alternatives.map((prior, position) => (position === index ? address : prior)),
    });
  }
  function remove(index: number) {
    onChange({ primary, alternatives: alternatives.filter((_, position) => position !== index) });
  }
  const primaryWarning = warning(primary);
  return (
    <Section
      title={label('addresses')}
      description={label('addressHint')}
      appearance="outlined"
      contentInset
    >
      <div className="grid min-w-0 max-w-2xl gap-4">
        {allowed.length ? (
          <p className="break-all text-sm text-ink-muted">
            {label('allowedOrigins')} {allowed.join(' · ')}
          </p>
        ) : (
          <p className="text-sm text-ink-muted">{label('noAllowedOrigins')}</p>
        )}
        <TextField
          label={label('primaryOrigin')}
          disabled={disabled}
          value={primary}
          onChange={(event) => onChange({ primary: event.target.value, alternatives })}
          {...(primaryWarning ? { error: primaryWarning } : {})}
        />
        {alternatives.map((address, index) => {
          const addressWarning = warning(address);
          return (
            <div key={index} className="grid min-w-0 items-end gap-2 sm:grid-cols-2">
              <TextField
                label={label('alternativeOrigin', index + 1)}
                disabled={disabled}
                value={address}
                onChange={(event) => edit(index, event.target.value)}
                {...(addressWarning ? { error: addressWarning } : {})}
              />
              <div>
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  onPress={() => remove(index)}
                >
                  {label('removeAlternative', index + 1)}
                </Action>
              </div>
            </div>
          );
        })}
        {invalid ? (
          <p role="alert" className="text-sm text-danger">
            {label('invalidOrigins')}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Action
            size="sm"
            variant="secondary"
            disabled={disabled || !allowed.length || alternatives.length >= maxSiteAlternatives}
            onPress={() => onChange({ primary, alternatives: [...alternatives, ''] })}
          >
            {label('addAlternative')}
          </Action>
          {primary || alternatives.length ? (
            <Action
              size="sm"
              variant="quiet"
              disabled={disabled}
              onPress={() => onChange({ primary: '', alternatives: [] })}
            >
              {label('clearOrigins')}
            </Action>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

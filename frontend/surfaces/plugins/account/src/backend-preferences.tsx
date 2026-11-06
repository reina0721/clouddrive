'use client';
import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { isSupportedTimeZone, supportedTimeZones } from '@clouddrive/i18n/format';
import { Section } from '@clouddrive/surface-foundation/layout';
import { ComboField, SelectField, CheckboxField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useRequiredAdministration } from '../../../src/administration/context';
import type { AccountPreferences } from '../../../src/administration/model';
import { useRemote, RemoteRegion } from '../../../src/administration/resource-state';

function PreferenceEditor({
  value,
  onSaved,
}: Readonly<{ value: AccountPreferences; onSaved: () => void }>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const [draft, setDraft] = useState(value);
  const [failure, setFailure] = useState<string>();
  return (
    <DialogSurface
      triggerLabel={t('administration.edit')}
      title={t('administration.preferences')}
      description={t('administration.description')}
      cancelLabel={t('administration.cancel')}
      confirmLabel={t('administration.save')}
      {...(failure ? { failureMessage: failure } : {})}
      onConfirm={async () => {
        if (!isSupportedTimeZone(draft.timeZone || 'auto')) {
          setFailure(t('administration.invalidTimeZone'));
          throw new RangeError('Unsupported account time zone');
        }
        try {
          await port.savePreferences(draft);
          onSaved();
        } catch (error) {
          setFailure(t('administration.failureDescription'));
          throw error;
        }
      }}
    >
      <SelectField
        label={t('administration.language')}
        value={draft.language}
        onValueChange={(language) =>
          setDraft((prior) => ({ ...prior, language: language === 'zh-CN' ? 'zh-CN' : 'en-US' }))
        }
        options={[
          { value: 'zh-CN', label: '简体中文' },
          { value: 'en-US', label: 'English' },
        ]}
      />
      <ComboField
        label={t('administration.timeZone')}
        placeholder={t('administration.timeZone')}
        options={supportedTimeZones(draft.timeZone).map((zone) => ({
          value: zone,
          label: zone === 'auto' ? t('administration.timeZoneAuto') : zone,
        }))}
        value={draft.timeZone || 'auto'}
        onValueChange={(timeZone) =>
          setDraft((prior) => ({ ...prior, timeZone: timeZone === 'auto' ? '' : timeZone }))
        }
      />
      <SelectField
        label={t('administration.themeMode')}
        value={draft.themeMode}
        onValueChange={(themeMode) => {
          if (themeMode === 'system' || themeMode === 'light' || themeMode === 'dark')
            setDraft((prior) => ({ ...prior, themeMode }));
        }}
        options={['system', 'light', 'dark'].map((value) => ({
          value,
          label: t(`administration.themeModes.${value}`),
        }))}
      />
      <SelectField
        label={t('administration.themePreset')}
        {...(draft.themePreset === 'cyan' ? { hint: t('administration.cyanHint') } : {})}
        value={draft.themePreset}
        onValueChange={(themePreset) => {
          if (
            themePreset === 'blue' ||
            themePreset === 'cyan' ||
            themePreset === 'green' ||
            themePreset === 'violet' ||
            themePreset === 'orange'
          )
            setDraft((prior) => ({ ...prior, themePreset }));
        }}
        options={['blue', 'cyan', 'green', 'violet', 'orange'].map((value) => ({
          value,
          label: t(`administration.colors.${value}`),
        }))}
      />
      <SelectField
        label={t('administration.density')}
        value={draft.density}
        onValueChange={(density) =>
          setDraft((prior) => ({
            ...prior,
            density: density === 'compact' ? 'compact' : 'comfortable',
          }))
        }
        options={['compact', 'comfortable'].map((value) => ({
          value,
          label: t(`administration.densityLevels.${value}`),
        }))}
      />
      <CheckboxField
        label={t('administration.reduceMotion')}
        checked={draft.reduceMotion}
        onCheckedChange={(reduceMotion) => setDraft((prior) => ({ ...prior, reduceMotion }))}
      />
      {(['emailDigest', 'inApp', 'showSummaries', 'dailySummary'] as const).map((key) => (
        <CheckboxField
          key={key}
          label={t(`administration.${key}`)}
          checked={draft.notifications[key]}
          onCheckedChange={(checked) =>
            setDraft((prior) => ({
              ...prior,
              notifications: { ...prior.notifications, [key]: checked },
            }))
          }
        />
      ))}
    </DialogSurface>
  );
}
export function BackendPreferences() {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const state = useRemote(useCallback(() => port.preferences(), [port]));
  return (
    <Section title={t('administration.preferences')}>
      <RemoteRegion {...state}>
        {state.value ? (
          <PreferenceEditor key={state.value.version} value={state.value} onSaved={state.reload} />
        ) : null}
      </RemoteRegion>
    </Section>
  );
}

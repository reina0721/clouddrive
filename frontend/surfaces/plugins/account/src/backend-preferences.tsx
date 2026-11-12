'use client';
import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { isSupportedTimeZone, supportedTimeZones } from '@clouddrive/i18n/format';
import { Section } from '@clouddrive/surface-foundation/layout';
import { ComboField, SelectField, CheckboxField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { Action } from '@clouddrive/ui-adapter/action';
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
  const [open, setOpen] = useState(false);
  return (
    <>
      <Action
        variant="secondary"
        onPress={() => {
          setDraft(value);
          setFailure(undefined);
          setOpen(true);
        }}
      >
        {t('administration.edit')}
      </Action>
      <DialogSurface
        isOpen={open}
        triggerLabel={t('administration.edit')}
        title={t('administration.preferences')}
        description={t('administration.description')}
        cancelLabel={t('administration.cancel')}
        confirmLabel={t('administration.save')}
        onOpenChange={setOpen}
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
    </>
  );
}
export function BackendPreferences() {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const state = useRemote(useCallback(() => port.preferences(), [port]));
  return (
    <Section title={t('administration.preferences')} contentInset>
      <RemoteRegion {...state}>
        {state.value ? (
          <div className="space-y-4">
            <DescriptionList
              label={t('administration.preferences')}
              columns={2}
              items={[
                {
                  id: 'language',
                  term: t('administration.language'),
                  description: state.value.language === 'zh-CN' ? '简体中文' : 'English',
                },
                {
                  id: 'timeZone',
                  term: t('administration.timeZone'),
                  description: state.value.timeZone || t('administration.timeZoneAuto'),
                },
                {
                  id: 'themeMode',
                  term: t('administration.themeMode'),
                  description: t('administration.themeModes.' + state.value.themeMode),
                },
                {
                  id: 'themePreset',
                  term: t('administration.themePreset'),
                  description: t('administration.colors.' + state.value.themePreset),
                },
                {
                  id: 'density',
                  term: t('administration.density'),
                  description: t('administration.densityLevels.' + state.value.density),
                },
                {
                  id: 'reduceMotion',
                  term: t('administration.reduceMotion'),
                  description: t(
                    state.value.reduceMotion ? 'administration.active' : 'administration.disabled',
                  ),
                },
                ...(['emailDigest', 'inApp', 'showSummaries', 'dailySummary'] as const).map(
                  (key) => ({
                    id: key,
                    term: t('administration.' + key),
                    description: t(
                      state.value?.notifications[key]
                        ? 'administration.active'
                        : 'administration.disabled',
                    ),
                  }),
                ),
              ]}
            />
            <PreferenceEditor
              key={state.value.version}
              value={state.value}
              onSaved={state.reload}
            />
          </div>
        ) : null}
      </RemoteRegion>
    </Section>
  );
}

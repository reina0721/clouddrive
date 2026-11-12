'use client';
import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Section } from '@clouddrive/surface-foundation/layout';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { Action } from '@clouddrive/ui-adapter/action';
import { useRequiredAdministration } from '../../../src/administration/context';
import type { AccountProfile } from '../../../src/administration/model';
import { useRemote, RemoteRegion } from '../../../src/administration/resource-state';

function ProfileEditor({
  profile,
  onSaved,
}: Readonly<{ profile: AccountProfile; onSaved: () => void }>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const [value, setValue] = useState(profile);
  const [failure, setFailure] = useState<string>();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Action
        variant="secondary"
        onPress={() => {
          setValue(profile);
          setFailure(undefined);
          setOpen(true);
        }}
      >
        {t('administration.edit')}
      </Action>
      <DialogSurface
        isOpen={open}
        triggerLabel={t('administration.edit')}
        title={t('administration.profile')}
        description={t('administration.description')}
        confirmLabel={t('administration.save')}
        cancelLabel={t('administration.cancel')}
        onOpenChange={setOpen}
        {...(failure ? { failureMessage: failure } : {})}
        onConfirm={async () => {
          try {
            await port.saveProfile(value);
            onSaved();
          } catch (error) {
            setFailure(t('administration.failureDescription'));
            throw error;
          }
        }}
      >
        {(['nickname', 'bio', 'birthDate'] as const).map((field) => (
          <TextField
            key={field}
            label={t(`administration.${field}`)}
            value={value[field]}
            maxLength={field === 'nickname' ? 64 : field === 'bio' ? 2048 : 16}
            onChange={(event) => setValue((prior) => ({ ...prior, [field]: event.target.value }))}
          />
        ))}
      </DialogSurface>
    </>
  );
}
export function BackendProfile({ onSaved }: Readonly<{ onSaved: () => void }>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const state = useRemote(useCallback(() => port.profile(), [port]));
  return (
    <Section title={t('administration.profile')} contentInset>
      <RemoteRegion {...state}>
        {state.value ? (
          <>
            <DescriptionList
              label={t('administration.profile')}
              columns={1}
              items={(['nickname', 'bio', 'birthDate'] as const).map((field) => ({
                id: field,
                term: t('administration.' + field),
                description: state.value?.[field] || '—',
              }))}
            />
            <ProfileEditor
              key={state.value.version}
              profile={state.value}
              onSaved={() => {
                state.reload();
                onSaved();
              }}
            />
          </>
        ) : null}
      </RemoteRegion>
    </Section>
  );
}

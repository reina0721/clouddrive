'use client';
import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Section } from '@clouddrive/surface-foundation/layout';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
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
  return (
    <DialogSurface
      triggerLabel={t('administration.edit')}
      title={t('administration.profile')}
      description={t('administration.description')}
      confirmLabel={t('administration.save')}
      cancelLabel={t('administration.cancel')}
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
          onChange={(event) => setValue((prior) => ({ ...prior, [field]: event.target.value }))}
        />
      ))}
    </DialogSurface>
  );
}
export function BackendProfile({ onSaved }: Readonly<{ onSaved: () => void }>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const state = useRemote(useCallback(() => port.profile(), [port]));
  return (
    <Section title={t('administration.profile')}>
      <RemoteRegion {...state}>
        {state.value ? (
          <>
            <p>{state.value.nickname}</p>
            <p>{state.value.bio}</p>
            <p>{state.value.birthDate}</p>
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

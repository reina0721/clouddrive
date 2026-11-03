'use client';
import { useEffect, useState } from 'react';
import { Collection } from '@clouddrive/surface-foundation/collection';
import { EntitySummary, SettingsLayout } from '@clouddrive/surface-foundation/detail-settings';
import { FormActions, FormStatus } from '@clouddrive/surface-foundation/form-actions';
import { Page, PageHeader, Section, SplitView } from '@clouddrive/surface-foundation/layout';
import {
  OperationStatus,
  type OperationState,
} from '@clouddrive/surface-foundation/states-operations';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { SwitchField, TextField } from '@clouddrive/ui-adapter/form-field';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { TextLink } from '@clouddrive/ui-adapter/navigation';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { ContentSwapTransition } from '@clouddrive/ui-adapter/content-swap-transition';
import { Clock3, FileText } from 'lucide-react';
export type PageArchetypeKind = 'overview' | 'detail' | 'settings' | 'master-detail' | 'operation';
export function PageArchetypeShowcase({ kind }: Readonly<{ kind: PageArchetypeKind }>) {
  const { t } = useFrontendTranslation();
  const text = (key: string) => t(`pageArchetypes.scenario.${key}`);
  const [reviewing, setReviewing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('REF-028');
  const [savedName, setSavedName] = useState('REF-028');
  const [notifications, setNotifications] = useState(true);
  const [savedNotifications, setSavedNotifications] = useState(true);
  const [selected, setSelected] = useState('review');
  const [operation, setOperation] = useState<OperationState>('queued');
  const [progress, setProgress] = useState(0);
  const [fail, setFail] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const dirty = name !== savedName || notifications !== savedNotifications;
  const save = () => {
    if (!name.trim()) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setSavedName(name.trim());
    setSavedNotifications(notifications);
    setEditing(false);
  };
  const reset = () => {
    setName(savedName);
    setNotifications(savedNotifications);
    setInvalid(false);
  };
  useEffect(() => {
    if (operation !== 'running') return;
    const timer = setInterval(() => setProgress((value) => Math.min(100, value + 25)), 400);
    return () => clearInterval(timer);
  }, [operation]);
  useEffect(() => {
    if (operation !== 'running' || progress !== 100) return;
    const timer = setTimeout(() => setOperation(fail ? 'failed' : 'succeeded'), 0);
    return () => clearTimeout(timer);
  }, [operation, progress, fail]);
  const form = (
    <>
      <Section id="general" title={text('general')} contentInset>
        <TextField
          label={text('name')}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          {...(invalid ? { error: text('required') } : {})}
        />
      </Section>
      <Section id="notifications" title={text('notifications')} contentInset>
        <SwitchField
          label={text('notifications')}
          description={text('notificationsHint')}
          checked={notifications}
          onCheckedChange={setNotifications}
        />
      </Section>
      <FormActions
        primary={
          <Action onPress={save} disabled={!dirty}>
            {text('save')}
          </Action>
        }
        secondary={
          <Action variant="quiet" onPress={reset} disabled={!dirty}>
            {text('reset')}
          </Action>
        }
        summary={
          <FormStatus
            lifecycle={invalid ? 'invalid' : dirty ? 'dirty' : 'pristine'}
            labels={{
              pristine: text('saved'),
              dirty: text('unsaved'),
              submitting: text('saving'),
              submitted: text('saved'),
              invalid: text('required'),
            }}
          />
        }
      />
    </>
  );
  return (
    <Page>
      <PageHeader
        eyebrow={text('eyebrow')}
        title={text(`title.${kind}`)}
        description={text('description')}
      />
      {kind === 'overview' ? (
        <Section title={text('review')} appearance="outlined">
          <StateSurface
            compact
            state="warning"
            title={text('queue')}
            description={text('queueDescription')}
            icon={<Clock3 className="size-5" />}
            actionLabel={text('review')}
            onAction={() => setReviewing(true)}
          />
          {reviewing ? (
            <div className="grid gap-3 p-5">
              <p>{text('reviewContent')}</p>
              <Action onPress={() => setReviewing(false)}>{text('complete')}</Action>
            </div>
          ) : null}
        </Section>
      ) : kind === 'detail' ? (
        <>
          <EntitySummary
            title={savedName}
            description={text('entityDescription')}
            actions={
              <Action onPress={() => setEditing(true)} disabled={editing}>
                {text('edit')}
              </Action>
            }
          />
          {editing ? (
            form
          ) : (
            <Section title={text('activity')} contentInset>
              {text('activityContent')}
            </Section>
          )}
        </>
      ) : kind === 'settings' ? (
        <SettingsLayout
          persistentNavigation
          navigation={
            <Panel appearance="outlined" className="grid gap-2 p-3">
              <TextLink href="#general">{text('general')}</TextLink>
              <TextLink href="#notifications">{text('notifications')}</TextLink>
            </Panel>
          }
        >
          {form}
        </SettingsLayout>
      ) : kind === 'master-detail' ? (
        <SplitView
          master={
            <Collection
              title={text('resources')}
              content={
                <div className="grid gap-1 p-2">
                  {['review', 'release', 'audit'].map((id) => (
                    <Action
                      fullWidth
                      key={id}
                      variant={selected === id ? 'secondary' : 'quiet'}
                      onPress={() => setSelected(id)}
                    >
                      {text(id)}
                    </Action>
                  ))}
                </div>
              }
            />
          }
          detail={
            <ContentSwapTransition contentKey={selected}>
              <EntitySummary title={text(selected)} description={text(`detail.${selected}`)} />
            </ContentSwapTransition>
          }
        />
      ) : (
        <>
          <SwitchField
            label={text('fail')}
            description={text('failDescription')}
            checked={fail}
            onCheckedChange={setFail}
            disabled={operation === 'running'}
          />
          <OperationStatus
            state={operation}
            title={text(`operation.${operation}`)}
            description={text('operationDescription')}
            icon={<FileText className="size-5" />}
            progress={progress}
            progressLabel={text('progress')}
            actions={
              operation === 'running' ? (
                <Action variant="secondary" onPress={() => setOperation('cancelled')}>
                  {text('cancel')}
                </Action>
              ) : (
                <Action
                  onPress={() => {
                    setProgress(0);
                    setOperation('running');
                  }}
                >
                  {text(operation === 'failed' ? 'retry' : 'run')}
                </Action>
              )
            }
          />
        </>
      )}
    </Page>
  );
}

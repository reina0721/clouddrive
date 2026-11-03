'use client';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useRegisterDirtySource } from '@clouddrive/plugin-framework/leave-confirm';
import type { ApiEnvironment, KeyValueEntry } from '@clouddrive/surface/api-workbench';
import { Action } from '@clouddrive/ui-adapter/action';
import {
  DrawerSurface,
  ConfirmDialog,
  DestructiveConfirmDialog,
} from '@clouddrive/ui-adapter/overlays';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { TabsView, type TabsViewItem } from '@clouddrive/ui-adapter/data-display';
import { SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { Plus, Save, Trash2 } from 'lucide-react';
import { KeyValueEditor } from './key-value-editor';
export type EnvironmentSection = 'envs' | 'globals';
export type EnvironmentDrawerProps = Readonly<{
  section: EnvironmentSection;
  activeEnvironmentId?: string | undefined;
  environments: readonly ApiEnvironment[];
  globals: readonly KeyValueEntry[];
  onClose: () => void;
  onSave: (
    environments: readonly ApiEnvironment[],
    globals: readonly KeyValueEntry[],
  ) => Promise<void>;
}>;
export function EnvironmentDrawer({
  section,
  environments,
  globals,
  activeEnvironmentId,
  onClose,
  onSave,
}: EnvironmentDrawerProps) {
  const { t } = useFrontendTranslation();
  const [envs, setEnvs] = useState(environments);
  const [globalDraft, setGlobalDraft] = useState(globals);
  const [activeTab, setActiveTab] = useState<EnvironmentSection>(section);
  const [selectedId, setSelectedId] = useState(activeEnvironmentId ?? environments[0]?.id ?? '');
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const dirty = JSON.stringify([envs, globalDraft]) !== JSON.stringify([environments, globals]);
  const current = envs.find((env) => env.id === selectedId) ?? envs[0];
  useRegisterDirtySource({
    pageId: 'api-workbench.variables',
    isDirty: () => dirty,
    isSubmitting: () => pending,
    message: () => t('apiWorkbench.workspace.dirtyLeave'),
  });
  const close = () => {
    if (pending) return;
    if (dirty) setDiscard(true);
    else onClose();
  };
  const items: readonly TabsViewItem[] = [
    {
      id: 'envs',
      label: t('apiWorkbench.environments.envsTab'),
      content: (
        <div className="grid min-w-0 gap-5">
          <div className="grid min-w-0 gap-3">
            <TextField
              label={t('apiWorkbench.environments.envName')}
              placeholder={t('apiWorkbench.environments.addPlaceholder')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <div>
              <Action
                size="sm"
                variant="secondary"
                disabled={!name.trim() || pending}
                leadingIcon={<Plus className="size-4" />}
                onPress={() => {
                  const env: ApiEnvironment = {
                    id: `env_${Date.now().toString(36)}`,
                    name: name.trim(),
                    variables: [],
                  };
                  setEnvs([...envs, env]);
                  setSelectedId(env.id);
                  setName('');
                }}
              >
                {t('apiWorkbench.environments.addEnv')}
              </Action>
            </div>
          </div>
          {envs.length === 0 ? (
            <p className="text-sm leading-6 text-ink-muted">
              {t('apiWorkbench.environments.empty')}
            </p>
          ) : (
            <>
              <SelectField
                label={t('apiWorkbench.environments.envsTab')}
                value={current?.id ?? null}
                options={envs.map((env) => ({ value: env.id, label: env.name }))}
                onValueChange={setSelectedId}
              />
              {current && (
                <div className="grid min-w-0 gap-4 border-t border-border pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 break-words text-sm font-semibold text-ink">
                      {t('apiWorkbench.environments.variables', { name: current.name })}
                    </span>
                    <IconAction
                      label={t('apiWorkbench.environments.deleteEnv')}
                      onPress={() => setDeleteId(current.id)}
                    >
                      <Trash2 className="size-4 text-danger" />
                    </IconAction>
                  </div>
                  <KeyValueEditor
                    entries={current.variables}
                    onChange={(variables) =>
                      setEnvs(
                        envs.map((env) => (env.id === current.id ? { ...env, variables } : env)),
                      )
                    }
                    keyPlaceholder="baseUrl"
                    valuePlaceholder="https://api.example.com"
                  />
                </div>
              )}
            </>
          )}
        </div>
      ),
    },
    {
      id: 'globals',
      label: t('apiWorkbench.environments.globalsTab'),
      content: <KeyValueEditor entries={globalDraft} onChange={setGlobalDraft} />,
    },
  ];
  return (
    <DrawerSurface
      triggerLabel={t('apiWorkbench.environments.title')}
      title={t('apiWorkbench.environments.title')}
      description={t('apiWorkbench.environments.description')}
      closeLabel={t('apiWorkbench.common.close')}
      isOpen
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <div className="grid min-w-0 gap-5">
        <TabsView
          label={t('apiWorkbench.environments.title')}
          items={items}
          selectedId={activeTab}
          onSelectionChange={(id) => setActiveTab(id === 'globals' ? 'globals' : 'envs')}
        />
        {dirty && (
          <p className="text-sm text-ink-muted" role="status">
            {t('apiWorkbench.environments.dirty')}
          </p>
        )}
        {failed && (
          <p role="alert" className="text-sm text-danger">
            {t('apiWorkbench.feedback.saveFailed')}
          </p>
        )}
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-surface py-4">
          <Action variant="secondary" disabled={pending} onPress={close}>
            {t('apiWorkbench.common.cancel')}
          </Action>
          <Action
            leadingIcon={<Save className="size-4" />}
            loading={pending}
            disabled={!dirty}
            onPress={() => {
              setPending(true);
              setFailed(false);
              void onSave(envs, globalDraft)
                .catch(() => setFailed(true))
                .finally(() => setPending(false));
            }}
          >
            {t('apiWorkbench.environments.save')}
          </Action>
        </div>
      </div>
      <ConfirmDialog
        triggerLabel={t('apiWorkbench.environments.discardTitle')}
        title={t('apiWorkbench.environments.discardTitle')}
        description={t('apiWorkbench.environments.discardDescription')}
        impact={t('apiWorkbench.environments.dirty')}
        cancelLabel={t('apiWorkbench.common.cancel')}
        confirmLabel={t('apiWorkbench.environments.discard')}
        failureMessage={t('apiWorkbench.common.failed')}
        isOpen={discard}
        onOpenChange={setDiscard}
        onConfirm={onClose}
      />
      <DestructiveConfirmDialog
        triggerLabel={t('apiWorkbench.environments.deleteEnv')}
        title={t('apiWorkbench.common.deleteTitle')}
        description={t('apiWorkbench.common.deleteDescription', {
          name: envs.find((env) => env.id === deleteId)?.name,
        })}
        impact={t('apiWorkbench.common.deleteOneImpact')}
        cancelLabel={t('apiWorkbench.common.cancel')}
        confirmLabel={t('apiWorkbench.common.delete')}
        failureMessage={t('apiWorkbench.common.failed')}
        isOpen={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        onConfirm={() => {
          setEnvs(envs.filter((env) => env.id !== deleteId));
          setDeleteId(null);
        }}
      />
    </DrawerSurface>
  );
}

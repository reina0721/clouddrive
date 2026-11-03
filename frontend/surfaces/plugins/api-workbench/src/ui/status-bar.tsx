'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import type { ApiEnvironment, ApiRequestDefinition } from '@clouddrive/surface/api-workbench';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField } from '@clouddrive/ui-adapter/form-field';
import { MenuButton } from '@clouddrive/ui-adapter/menu-button';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { Download, Folder, Sliders, Upload } from 'lucide-react';
export type WorkbenchToolbarProps = Readonly<{
  environments: readonly ApiEnvironment[];
  activeEnvironmentId?: string | undefined;
  dbUsage: string | null;
  projectsVisible: boolean;
  mode: 'mock' | 'backend';
  pending: boolean;
  hasDrafts: boolean;
  historyDrafts: readonly ApiRequestDefinition[];
  onSelectHistoryDraft: (id: string) => void;
  onSelectEnvironment: (id: string | undefined) => void;
  onOpenProjects: () => void;
  onOpenEnvironments: () => void;
  onOpenGlobals: () => void;
  onExport: () => void;
  onImport: () => void;
}>;
export function WorkbenchToolbar({
  environments,
  activeEnvironmentId,
  dbUsage,
  projectsVisible,
  mode,
  pending,
  hasDrafts,
  historyDrafts,
  onSelectHistoryDraft,
  onSelectEnvironment,
  onOpenProjects,
  onOpenEnvironments,
  onOpenGlobals,
  onExport,
  onImport,
}: WorkbenchToolbarProps) {
  const { t } = useFrontendTranslation();
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {
          <Action
            size="sm"
            variant="secondary"
            leadingIcon={<Folder className="size-4" />}
            onPress={onOpenProjects}
          >
            {t(
              projectsVisible
                ? 'apiWorkbench.workspace.hideProjects'
                : 'apiWorkbench.workspace.navigation',
            )}
          </Action>
        }
        <SelectField
          presentation="toolbar"
          label={t('apiWorkbench.bottomBar.env')}
          value={activeEnvironmentId ?? 'none'}
          options={[
            { value: 'none', label: t('apiWorkbench.bottomBar.noEnv') },
            ...environments.map((env) => ({ value: env.id, label: env.name })),
          ]}
          disabled={pending}
          onValueChange={(value) => onSelectEnvironment(value === 'none' ? undefined : value)}
        />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Action
          size="sm"
          variant="quiet"
          leadingIcon={<Sliders className="size-4" />}
          onPress={onOpenEnvironments}
        >
          {t('apiWorkbench.bottomBar.manageEnvs')}
        </Action>
        <MenuButton
          label={t('apiWorkbench.workspace.menu')}
          ariaLabel={t('apiWorkbench.workspace.menu')}
          header={
            <div className="grid max-w-64 gap-2">
              <span>
                {dbUsage
                  ? t('apiWorkbench.workspace.storage', { size: dbUsage })
                  : t('apiWorkbench.workspace.loading')}
              </span>
              <span>{t('apiWorkbench.workspace.version', { value: '0.4.0' })}</span>
              {hasDrafts && (
                <p className="text-xs leading-5 text-ink-muted">
                  {t('apiWorkbench.workspace.unsavedExport')}
                </p>
              )}
            </div>
          }
          items={[
            ...historyDrafts.map((request) => ({ id: request.id, label: request.name })),
            { id: 'globals', label: t('apiWorkbench.bottomBar.setGlobals') },
            {
              id: 'export',
              label: t('apiWorkbench.sidebar.exportWorkspace'),
              icon: <Download className="size-4" />,
              disabled: pending,
            },
            {
              id: 'import',
              label: t('apiWorkbench.sidebar.importWorkspace'),
              icon: <Upload className="size-4" />,
              disabled: pending,
            },
          ]}
          onAction={(id) => {
            if (id === 'globals') onOpenGlobals();
            else if (id === 'export') onExport();
            else if (id === 'import') onImport();
            else onSelectHistoryDraft(id);
          }}
        />
        <StatusPill tone={mode === 'mock' ? 'neutral' : 'info'}>
          {t(mode === 'mock' ? 'apiWorkbench.workspace.mock' : 'apiWorkbench.workspace.backend')}
        </StatusPill>
      </div>
    </div>
  );
}

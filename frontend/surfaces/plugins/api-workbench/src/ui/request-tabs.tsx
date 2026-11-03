'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import type { ApiRequestDefinition } from '@clouddrive/surface/api-workbench';
import { TabsView, type TabsViewItem } from '@clouddrive/ui-adapter/data-display';
import { useWorkbenchStore } from '../../stores/workbench';
import { AuthPanel } from './auth-panel';
import { BodyPanel } from './body-panel';
import { DisguisePanel } from './disguise-panel';
import { ExtractorsPanel } from './extractors-panel';
import { KeyValueEditor } from './key-value-editor';
import { ScriptPanel } from './script-panel';

export type RequestTabsProps = Readonly<{
  request: ApiRequestDefinition;
  onChange: (patch: Partial<ApiRequestDefinition>) => void;
}>;

export function RequestTabs({ request, onChange }: RequestTabsProps) {
  const { t } = useFrontendTranslation();
  const activeTab = useWorkbenchStore((s) => s.activeRequestTab);
  const setActiveTab = useWorkbenchStore((s) => s.setActiveRequestTab);

  const items: readonly TabsViewItem[] = [
    {
      id: 'params',
      label: t('apiWorkbench.tabs.params'),
      badge: request.params.filter((entry) => entry.enabled).length,
      content: (
        <div className="max-h-128 min-w-0 overflow-y-auto pt-1">
          <KeyValueEditor
            entries={request.params}
            onChange={(params) => onChange({ params })}
            showDescription
          />
        </div>
      ),
    },
    {
      id: 'headers',
      label: t('apiWorkbench.tabs.headers'),
      badge: request.headers.filter((entry) => entry.enabled).length,
      content: (
        <div className="max-h-128 min-w-0 overflow-y-auto pt-1">
          <KeyValueEditor
            entries={request.headers}
            onChange={(headers) => onChange({ headers })}
            showDescription
          />
        </div>
      ),
    },
    {
      id: 'auth',
      label: t('apiWorkbench.tabs.auth'),
      content: (
        <div className="max-h-128 min-w-0 overflow-y-auto pt-1">
          <AuthPanel auth={request.auth} onChange={(auth) => onChange({ auth })} />
        </div>
      ),
    },
    {
      id: 'disguise',
      label: t('apiWorkbench.tabs.disguise'),
      content: (
        <div className="max-h-128 min-w-0 overflow-y-auto pt-1">
          <DisguisePanel
            disguise={request.disguise}
            onChange={(disguise) => onChange({ disguise })}
          />
        </div>
      ),
    },
    {
      id: 'body',
      label: t('apiWorkbench.tabs.body'),
      content: (
        <div className="max-h-128 min-w-0 overflow-y-auto pt-1">
          <BodyPanel body={request.body} onChange={(body) => onChange({ body })} />
        </div>
      ),
    },
    {
      id: 'extractors',
      label: t('apiWorkbench.tabs.extractors'),
      badge: request.extractors.length,
      content: (
        <div className="max-h-128 min-w-0 overflow-y-auto pt-1">
          <ExtractorsPanel
            extractors={request.extractors}
            onChange={(extractors) => onChange({ extractors })}
          />
        </div>
      ),
    },
    {
      id: 'scripts',
      label: t('apiWorkbench.tabs.scripts'),
      content: (
        <div className="max-h-128 min-w-0 overflow-y-auto pt-1">
          <ScriptPanel
            preScript={request.preScript}
            postScript={request.postScript}
            onPreScriptChange={(preScript) => onChange({ preScript })}
            onPostScriptChange={(postScript) => onChange({ postScript })}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="grid min-w-0">
      <TabsView
        label={t('apiWorkbench.tabs.params')}
        items={items}
        selectedId={activeTab}
        onSelectionChange={(id) => {
          if (
            id === 'params' ||
            id === 'headers' ||
            id === 'auth' ||
            id === 'disguise' ||
            id === 'body' ||
            id === 'extractors' ||
            id === 'scripts'
          )
            setActiveTab(id);
        }}
      />
    </div>
  );
}

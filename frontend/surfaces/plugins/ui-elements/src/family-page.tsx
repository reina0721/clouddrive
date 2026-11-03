'use client';

import { Badge } from '@clouddrive/ui-adapter/feedback';
import { SelectField, SwitchField } from '@clouddrive/ui-adapter/form-field';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { ChevronRight } from 'lucide-react';
import { DisclosurePanel } from '@clouddrive/ui-adapter/disclosure';
import { route, RouteLink } from '@clouddrive/plugin-framework/plugin';
import { useSearchParams } from 'next/navigation';
import { Children, isValidElement, useState, type ReactNode } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { ComponentPreview } from './component-preview';
import { previewAnchor } from './preview-anchor';

import { usePluginLocale } from '@clouddrive/plugin-framework/plugin';
import { PageHeader, Page } from '@clouddrive/surface-foundation/layout';

const uiElementFamilies = [
  { id: 'actions-selection', labelKey: 'uiElements.nav.actionsSelection', count: 3 },
  { id: 'feedback', labelKey: 'uiElements.nav.feedback', count: 4 },
  { id: 'status-async', labelKey: 'uiElements.nav.statusAsync', count: 7 },
  { id: 'identity-display', labelKey: 'uiElements.nav.identityDisplay', count: 4 },
  { id: 'navigation', labelKey: 'uiElements.nav.navigation', count: 7 },
  { id: 'data', labelKey: 'uiElements.nav.data', count: 1 },
  { id: 'surfaces', labelKey: 'uiElements.nav.surfaces', count: 2 },
  { id: 'forms', labelKey: 'uiElements.nav.forms', count: 10 },
  { id: 'overlays', labelKey: 'uiElements.nav.overlays', count: 8 },
] as const;
const uiElementTotal = uiElementFamilies.reduce((total, family) => total + family.count, 0);

type UiElementFamilyId = (typeof uiElementFamilies)[number]['id'];
type UiElementsPageContext = Readonly<{
  density: 'comfortable' | 'compact';
  longText: boolean;
  setLongText: (enabled: boolean) => void;
  description: string;
  spacing: string;
}>;

export function UiElementsFamilyPage({
  familyId,
  title,
  description: familyDescription,
  children,
}: Readonly<{
  familyId: UiElementFamilyId;
  title: string;
  description: string;
  children: (context: UiElementsPageContext) => ReactNode;
}>) {
  const { t } = useFrontendTranslation();
  const searchParams = useSearchParams();
  const { locale, changeLocale } = usePluginLocale();
  const [density, setDensity] = useState<'comfortable' | 'compact'>(
    searchParams.get('density') === 'compact' ? 'compact' : 'comfortable',
  );
  const [longText, setLongText] = useState(false);
  const description = longText ? t('uiElements.longDescription') : t('uiElements.shortDescription');
  const spacing = density === 'compact' ? 'gap-2' : 'gap-4';
  const family = uiElementFamilies.find(({ id }) => id === familyId)!;

  const catalogNavigation = (
    <nav aria-label={t('uiElements.catalog.label')} className="mt-5 flex flex-wrap gap-2">
      {uiElementFamilies.map((item) => (
        <RouteLink
          className="inline-flex items-center gap-1.5 rounded-control font-semibold text-brand underline-offset-4 outline-none hover:text-brand-strong hover:underline"
          target={route(`ui-elements.${item.id}`)}
          key={item.id}
        >
          {t(item.labelKey)} · {item.count}
          <ChevronRight aria-hidden="true" className="size-4" />
        </RouteLink>
      ))}
    </nav>
  );
  const content = children({ density, longText, setLongText, description, spacing });
  const sections: { id: string; title: string }[] = [];
  const collect = (nodes: ReactNode) =>
    Children.forEach(nodes, (node) => {
      if (
        !isValidElement<{ id?: string; title?: string; name?: string; children?: ReactNode }>(node)
      )
        return;
      if (node.type === ComponentPreview && node.props.name)
        sections.push({ id: previewAnchor(node.props.name), title: node.props.name });
      if (node.props.id && typeof node.props.title === 'string')
        sections.push({ id: node.props.id, title: node.props.title });
      collect(node.props.children);
    });
  collect(content);
  return (
    <Page>
      <PageHeader
        breadcrumbLabel={t('layout.breadcrumb')}
        breadcrumbs={[
          { label: t('uiElements.breadcrumbRoot') },
          { label: t('uiElements.nav.root') },
          { label: title, current: true },
        ]}
        eyebrow={t('uiElements.eyebrow')}
        title={title}
        description={familyDescription}
      />

      <Panel className="surface-filter-grid p-4">
        <SelectField
          label={t('uiElements.density')}
          options={[
            { value: 'comfortable', label: t('uiElements.comfortable') },
            { value: 'compact', label: t('uiElements.compact') },
          ]}
          value={density}
          onValueChange={(value) => setDensity(value as 'comfortable' | 'compact')}
        />
        <SwitchField
          label={t('uiElements.longText')}
          description={t('uiElements.longTextDescription')}
          checked={longText}
          onCheckedChange={setLongText}
        />
        <SwitchField
          label={t('uiElements.locale')}
          description={t('uiElements.localeDescription')}
          checked={locale === 'en'}
          onCheckedChange={(enabled) => void changeLocale(enabled ? 'en' : 'zh-CN')}
        />
      </Panel>

      <div className="hidden md:block">
        <Panel appearance="outlined" aria-label={t('uiElements.catalog.label')} className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-widest text-brand">
                {t('uiElements.catalog.kicker')}
              </p>
              <h2 className="mt-2 text-xl font-extrabold text-ink">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">{familyDescription}</p>
            </div>
            <Badge appearance="solid" tone="info" size="md">
              {family.count} / {t('uiElements.catalog.total', { count: uiElementTotal })}
            </Badge>
          </div>
          {catalogNavigation}
        </Panel>
      </div>

      <div className="md:hidden">
        <DisclosurePanel title={t('uiElements.catalog.label') + ' · ' + title}>
          {catalogNavigation}
        </DisclosurePanel>
      </div>
      {sections.length > 1 ? (
        <nav aria-label={t('uiElements.sectionIndex')} className="flex flex-wrap gap-3">
          {sections.map((section) => (
            <RouteLink
              key={section.id}
              target={route('ui-elements.' + familyId, {}, { fragment: section.id })}
            >
              {section.title}
            </RouteLink>
          ))}
        </nav>
      ) : null}
      {content}
    </Page>
  );
}

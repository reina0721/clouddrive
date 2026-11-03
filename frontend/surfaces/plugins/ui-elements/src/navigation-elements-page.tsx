'use client';

import { TabsView } from '@clouddrive/ui-adapter/data-display';
import { DisclosurePanel } from '@clouddrive/ui-adapter/disclosure';
import { BreadcrumbTrail, PaginationControl, TextLink } from '@clouddrive/ui-adapter/navigation';
import { StepNavigation } from '@clouddrive/ui-adapter/step-navigation';
import { Tree } from '@clouddrive/ui-adapter/tree';
import {
  Bell,
  Boxes,
  ChevronRight,
  Component,
  LayoutDashboard,
  Users,
  Waypoints,
} from 'lucide-react';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Section } from '@clouddrive/surface-foundation/layout';
import { ComponentPreview } from './component-preview';
import { UiElementsFamilyPage } from './family-page';
export function NavigationElementsPage() {
  const { t } = useFrontendTranslation();
  const [page, setPage] = useState(2);
  const [contentTab, setContentTab] = useState('overview');
  const [, setLastAction] = useState<string>();
  return (
    <UiElementsFamilyPage
      familyId="navigation"
      title={t('uiElements.navigationTitle')}
      description={t('uiElements.catalog.navigationDescription')}
    >
      {({ description }) => (
        <>
          <Section
            id="navigation"
            title={t('uiElements.navigationTitle')}
            description={t('uiElements.catalog.navigationDescription')}
          >
            <div data-reveal-items className="grid gap-4 p-5 lg:grid-cols-2">
              <ComponentPreview
                name="TextLink"
                description={t('uiElements.catalog.textLinkDescription')}
                states={['Brand', 'Neutral', 'Leading / trailing icon', 'External', 'Host adapter']}
              >
                <div className="flex flex-wrap gap-5">
                  <TextLink href="#actions" leadingIcon={<ChevronRight />}>
                    {t('uiElements.catalog.backToActions')}
                  </TextLink>
                  <TextLink
                    href="#navigation"
                    tone="neutral"
                    trailingIcon={<ChevronRight />}
                    onNavigate={() => setLastAction('TextLink')}
                  >
                    {t('uiElements.catalog.interceptedLink')}
                  </TextLink>
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="BreadcrumbTrail"
                description={t('uiElements.catalog.breadcrumbDescription')}
                states={['Linked', 'Disabled', 'Current', 'aria-current']}
              >
                <BreadcrumbTrail
                  label={t('layout.breadcrumb')}
                  items={[
                    { id: 'root', label: t('uiElements.breadcrumbRoot'), href: '/' },
                    {
                      id: 'disabled',
                      label: t('uiElements.catalog.disabledLevel'),
                      disabled: true,
                    },
                    { id: 'current', label: t('uiElements.breadcrumbCurrent') },
                  ]}
                />
              </ComponentPreview>
              <ComponentPreview
                name="PaginationControl"
                description={t('uiElements.catalog.paginationDescription')}
                states={['Current', 'Previous / next', 'Ellipsis', 'Boundary', 'Disabled']}
              >
                <div className="grid gap-4">
                  <PaginationControl
                    getPageLabel={(pageNumber) => t('uiElements.pageLabel', { page: pageNumber })}
                    label={t('uiElements.paginationLabel')}
                    nextLabel={t('uiElements.nextPage')}
                    onPageChange={setPage}
                    page={page}
                    previousLabel={t('uiElements.previousPage')}
                    totalPages={12}
                  />
                  <PaginationControl
                    disabled
                    getPageLabel={(pageNumber) => t('uiElements.pageLabel', { page: pageNumber })}
                    label={t('uiElements.catalog.disabledPagination')}
                    nextLabel={t('uiElements.nextPage')}
                    onPageChange={() => undefined}
                    page={1}
                    previousLabel={t('uiElements.previousPage')}
                    totalPages={1}
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="TabsView · soft"
                description={t('uiElements.catalog.tabsSoftDescription')}
                states={['Overview', 'Notification', 'Analytics', 'Customers']}
              >
                <TabsView
                  label={t('uiElements.catalog.contentTabsLabel')}
                  variant="soft"
                  items={[
                    {
                      id: 'overview',
                      label: t('uiElements.catalog.tabsOverview'),
                      content: <p className="p-4 text-sm text-ink-muted">{description}</p>,
                    },
                    {
                      id: 'notifications',
                      label: t('uiElements.catalog.tabsNotifications'),
                      content: (
                        <p className="p-4 text-sm text-ink-muted">
                          {t('uiElements.dataTableEmpty')}
                        </p>
                      ),
                    },
                    {
                      id: 'analytics',
                      label: t('uiElements.catalog.tabsAnalytics'),
                      content: <p className="p-4 text-sm text-ink-muted">{description}</p>,
                    },
                    {
                      id: 'customers',
                      label: t('uiElements.catalog.tabsCustomers'),
                      content: <p className="p-4 text-sm text-ink-muted">{description}</p>,
                    },
                  ]}
                />
              </ComponentPreview>
              <ComponentPreview
                name="TabsView"
                description={t('uiElements.catalog.tabsDescription')}
                states={['Selected', 'Disabled', 'Controlled', 'Keyboard', 'Content tabs only']}
              >
                <TabsView
                  label={t('uiElements.catalog.contentTabsLabel')}
                  selectedId={contentTab}
                  onSelectionChange={setContentTab}
                  items={[
                    {
                      id: 'overview',
                      label: t('uiElements.normalTab'),
                      content: <p className="p-4 text-sm text-ink-muted">{description}</p>,
                    },
                    {
                      id: 'activity',
                      label: t('uiElements.emptyTab'),
                      content: (
                        <p className="p-4 text-sm text-ink-muted">
                          {t('uiElements.dataTableEmpty')}
                        </p>
                      ),
                    },
                    {
                      id: 'locked',
                      label: t('uiElements.catalog.locked'),
                      content: null,
                      disabled: true,
                    },
                  ]}
                />
              </ComponentPreview>
              <ComponentPreview
                name="TabsView · line + icon"
                description={t('uiElements.catalog.tabsIconDescription')}
                states={['Leading icon', 'Selected', 'Keyboard']}
              >
                <TabsView
                  label={t('uiElements.catalog.contentTabsLabel')}
                  items={[
                    {
                      id: 'overview',
                      label: t('uiElements.catalog.tabsOverview'),
                      icon: <LayoutDashboard className="size-4" />,
                      content: <p className="p-4 text-sm text-ink-muted">{description}</p>,
                    },
                    {
                      id: 'notifications',
                      label: t('uiElements.catalog.tabsNotifications'),
                      icon: <Bell className="size-4" />,
                      content: <p className="p-4 text-sm text-ink-muted">{description}</p>,
                    },
                    {
                      id: 'customers',
                      label: t('uiElements.catalog.tabsCustomers'),
                      icon: <Users className="size-4" />,
                      content: <p className="p-4 text-sm text-ink-muted">{description}</p>,
                    },
                  ]}
                />
              </ComponentPreview>
              <ComponentPreview
                name="TabsView · line + badge"
                description={t('uiElements.catalog.tabsBadgeDescription')}
                states={['Count badge', 'Selected', 'Readable on unselected']}
              >
                <TabsView
                  label={t('uiElements.catalog.contentTabsLabel')}
                  items={[
                    {
                      id: 'overview',
                      label: t('uiElements.catalog.tabsOverview'),
                      content: <p className="p-4 text-sm text-ink-muted">{description}</p>,
                    },
                    {
                      id: 'notifications',
                      label: t('uiElements.catalog.tabsNotifications'),
                      badge: 12,
                      content: <p className="p-4 text-sm text-ink-muted">{description}</p>,
                    },
                    {
                      id: 'customers',
                      label: t('uiElements.catalog.tabsCustomers'),
                      badge: 4,
                      content: <p className="p-4 text-sm text-ink-muted">{description}</p>,
                    },
                  ]}
                />
              </ComponentPreview>
              <ComponentPreview
                fullWidth
                name="TabsView · vertical"
                description={t('uiElements.catalog.tabsVerticalDescription')}
                states={['Two-column', 'Side indicator', 'ArrowUp/Down', 'Responsive']}
              >
                <div className="rounded-panel border border-border bg-surface p-4">
                  <TabsView
                    label={t('uiElements.catalog.contentTabsLabel')}
                    orientation="vertical"
                    items={[
                      {
                        id: 'overview',
                        label: t('uiElements.catalog.tabsOverview'),
                        content: <p className="p-4 text-sm text-ink-muted">{description}</p>,
                      },
                      {
                        id: 'notifications',
                        label: t('uiElements.catalog.tabsNotifications'),
                        content: <p className="p-4 text-sm text-ink-muted">{description}</p>,
                      },
                      {
                        id: 'analytics',
                        label: t('uiElements.catalog.tabsAnalytics'),
                        content: <p className="p-4 text-sm text-ink-muted">{description}</p>,
                      },
                      {
                        id: 'customers',
                        label: t('uiElements.catalog.tabsCustomers'),
                        content: <p className="p-4 text-sm text-ink-muted">{description}</p>,
                      },
                    ]}
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                fullWidth
                name="TabsView · section（Section Tabs in Panel）"
                description={t('uiElements.catalog.tabsSectionDescription')}
                states={['Embedded in Panel', 'No extra Surface/Toolbar', 'Keyboard']}
              >
                <Section
                  appearance="outlined"
                  contentInset
                  description={t('uiElements.catalog.tabsSectionDescription')}
                  title={t('uiElements.catalog.contentTabsLabel')}
                >
                  <TabsView
                    label={t('uiElements.catalog.contentTabsLabel')}
                    variant="section"
                    items={[
                      {
                        id: 'overview',
                        label: t('uiElements.normalTab'),
                        content: <p className="text-sm text-ink-muted">{description}</p>,
                      },
                      {
                        id: 'activity',
                        label: t('uiElements.emptyTab'),
                        content: (
                          <p className="text-sm text-ink-muted">{t('uiElements.dataTableEmpty')}</p>
                        ),
                      },
                    ]}
                  />
                </Section>
              </ComponentPreview>
              <ComponentPreview
                name="StepNavigation"
                description={t('uiElements.additional.steps')}
                states={['Upcoming', 'Current', 'Complete', 'Error', 'Disabled']}
              >
                <StepNavigation
                  label={t('uiElements.additional.stepsLabel')}
                  items={[
                    {
                      id: 'contract',
                      label: t('uiElements.additional.contract'),
                      state: 'complete',
                    },
                    {
                      id: 'accessibility',
                      label: t('uiElements.additional.accessibility'),
                      state: 'current',
                    },
                    { id: 'evidence', label: t('uiElements.additional.evidence') },
                  ]}
                />
              </ComponentPreview>
              <ComponentPreview
                name="Tree"
                description={t('uiElements.additional.tree')}
                states={[
                  'Nested',
                  'Expanded',
                  'Selected',
                  'Disabled',
                  'Keyboard',
                  'Long label',
                  'Icon + description',
                ]}
              >
                <Tree
                  collapseLabel={(label) => t('uiElements.catalog.treeCollapse', { label })}
                  defaultExpandedIds={new Set(['foundation'])}
                  expandLabel={(label) => t('uiElements.catalog.treeExpand', { label })}
                  label={t('uiElements.additional.treeLabel')}
                  nodes={[
                    {
                      id: 'foundation',
                      label: 'Universal Foundation',
                      description: t('uiElements.additional.treeDescription'),
                      leadingIcon: <Boxes className="size-icon-sm" />,
                      children: [
                        {
                          id: 'elements',
                          label: 'UI Elements',
                          leadingIcon: <Component className="size-icon-sm" />,
                        },
                        {
                          id: 'motion',
                          label: 'Motion',
                          disabled: true,
                          leadingIcon: <Waypoints className="size-icon-sm" />,
                        },
                        {
                          id: 'long-label',
                          label: t('uiElements.additional.longNode'),
                        },
                      ],
                    },
                    { id: 'surface', label: 'Surface Foundation' },
                  ]}
                  onAction={(id) => setLastAction(`Tree: ${id}`)}
                  selectionMode="single"
                />
              </ComponentPreview>
              <ComponentPreview
                name="DisclosurePanel"
                description={t('uiElements.additional.disclosure')}
                states={['Collapsed', 'Expanded', 'Disabled', 'Keyboard']}
              >
                <DisclosurePanel defaultExpanded title={t('uiElements.additional.composition')}>
                  {t('uiElements.additional.compositionHint')}
                </DisclosurePanel>
              </ComponentPreview>
            </div>
          </Section>
        </>
      )}
    </UiElementsFamilyPage>
  );
}

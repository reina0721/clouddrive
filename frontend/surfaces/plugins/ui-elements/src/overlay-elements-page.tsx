'use client';

import { Action } from '@clouddrive/ui-adapter/action';
import { CommandMenu } from '@clouddrive/ui-adapter/command-menu';
import { SwitchField, TextField } from '@clouddrive/ui-adapter/form-field';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { MenuButton } from '@clouddrive/ui-adapter/menu-button';
import { NavigationFlyout, NavigationHint } from '@clouddrive/ui-adapter/navigation-flyout';
import {
  ConfirmDialog,
  DestructiveConfirmDialog,
  DialogSurface,
  DrawerSurface,
  PopoverCard,
  TooltipAction,
} from '@clouddrive/ui-adapter/overlays';
import { Archive, Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Section } from '@clouddrive/surface-foundation/layout';
import { ComponentPreview } from './component-preview';
import { UiElementsFamilyPage } from './family-page';
export function OverlayElementsPage() {
  const footerFormId = useId();
  const [formBusy, setFormBusy] = useState(false);
  const { t } = useFrontendTranslation();
  const searchParams = useSearchParams();
  const overlay = searchParams.get('overlay');
  const [checked, setChecked] = useState(true);
  const [lastAction, setLastAction] = useState<string>();
  const [selectedChoice, setSelectedChoice] = useState('edit');
  const [navigationOpen, setNavigationOpen] = useState(false);
  return (
    <UiElementsFamilyPage
      familyId="overlays"
      title={t('uiElements.overlaysTitle')}
      description={t('uiElements.overlaysDescription')}
    >
      {({ description }) => (
        <>
          <Section
            id="overlays"
            title={t('uiElements.overlaysTitle')}
            description={t('uiElements.overlaysDescription')}
          >
            <div data-reveal-items className="grid gap-4 p-5 lg:grid-cols-2">
              <ComponentPreview
                name="MenuButton"
                description={t('uiElements.catalog.menuDescription')}
                states={['Default', 'Icon', 'Description', 'Disabled', 'Danger', 'Keyboard']}
              >
                <MenuButton
                  ariaLabel={t('uiElements.menuLabel')}
                  label={t('uiElements.menu')}
                  defaultOpen={overlay === 'menu'}
                  onAction={(id) => setLastAction(id)}
                  items={[
                    {
                      id: 'edit',
                      label: t('uiElements.menuEdit'),
                      icon: <Pencil className="size-4" />,
                    },
                    {
                      id: 'copy',
                      label: t('uiElements.menuCopy'),
                      icon: <Copy className="size-4" />,
                    },
                    {
                      id: 'archive',
                      label: t('uiElements.menuArchive'),
                      icon: <Archive className="size-4" />,
                      disabled: true,
                    },
                    {
                      id: 'delete',
                      label: t('uiElements.menuDelete'),
                      icon: <Trash2 className="size-4" />,
                      tone: 'danger',
                    },
                  ]}
                />
              </ComponentPreview>
              <ComponentPreview
                name="MenuButton · Material triggers"
                description={t('uiElements.catalog.menuDescription')}
                states={['Default', 'Icon', 'Keyboard', 'Touch']}
              >
                <div className="flex items-center gap-3">
                  <MenuButton
                    ariaLabel={t('uiElements.tonalMenu')}
                    label={t('uiElements.menu')}
                    triggerVariant="primary"
                    items={[{ id: 'edit', label: t('uiElements.menuEdit') }]}
                    onAction={setLastAction}
                  />
                  <MenuButton
                    ariaLabel={t('uiElements.iconMenu')}
                    label={<MoreHorizontal className="size-5" />}
                    triggerVariant="icon"
                    items={[{ id: 'copy', label: t('uiElements.menuCopy') }]}
                    onAction={setLastAction}
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="MenuButton · Groups / Submenu"
                description={t('uiElements.groupedMenu')}
                states={['Group', 'Selected', 'Submenu', 'Keyboard', 'Touch', 'Collision']}
              >
                <MenuButton
                  label={t('uiElements.groupedMenu')}
                  ariaLabel={t('uiElements.groupedMenu')}
                  onAction={(id) => {
                    setSelectedChoice(id);
                    setLastAction(id);
                  }}
                  groups={[
                    {
                      id: 'choices',
                      label: t('uiElements.menuChoices'),
                      items: [
                        {
                          id: 'choice',
                          label: t('uiElements.menuChoices'),
                          value: t(
                            selectedChoice === 'edit'
                              ? 'uiElements.menuEdit'
                              : 'uiElements.menuCopy',
                          ),
                          selectedId: selectedChoice,
                          options: [
                            { id: 'edit', label: t('uiElements.menuEdit') },
                            { id: 'copy', label: t('uiElements.menuCopy') },
                          ],
                        },
                      ],
                    },
                    {
                      id: 'actions',
                      label: t('uiElements.menuActions'),
                      items: [
                        { id: 'archive', label: t('uiElements.menuArchive'), disabled: true },
                      ],
                    },
                  ]}
                />
              </ComponentPreview>
              <ComponentPreview
                name="PopoverCard"
                description={t('uiElements.catalog.popoverDescription')}
                states={['Trigger', 'Heading', 'Long content', 'Focus return', 'Collision']}
              >
                <PopoverCard
                  triggerLabel={t('uiElements.popover')}
                  title={t('uiElements.popoverTitle')}
                  defaultOpen={overlay === 'popover'}
                >
                  {description}
                </PopoverCard>
              </ComponentPreview>
              <ComponentPreview
                name="TooltipAction"
                description={t('uiElements.catalog.tooltipDescription')}
                states={['Hover', 'Focus', 'Delay', 'Escape', 'Non-interactive content']}
              >
                <TooltipAction
                  label={t('uiElements.tooltip')}
                  tooltip={t('uiElements.tooltipContent')}
                  defaultOpen={overlay === 'tooltip'}
                />
                <div className="mt-4 flex items-center gap-3">
                  <NavigationHint label={t('uiElements.popoverTitle')}>
                    <a
                      href="#element-popovercard"
                      aria-label={t('uiElements.popoverTitle')}
                      className="ui-navigation-icon-trigger"
                    >
                      <Copy aria-hidden="true" className="size-icon-lg" />
                    </a>
                  </NavigationHint>
                  <NavigationFlyout
                    label={t('uiElements.overlaysTitle')}
                    icon={<Copy className="size-full" />}
                    isOpen={navigationOpen}
                    onOpenChange={setNavigationOpen}
                  >
                    <a
                      href="#element-tooltipaction"
                      className="block rounded-control px-3 py-2 text-sm text-ink outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      {t('uiElements.tooltip')}
                    </a>
                  </NavigationFlyout>
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="DialogSurface"
                description={t('uiElements.catalog.dialogDescription')}
                states={['Form content', 'Cancel', 'Confirm', 'Pending', 'Failure', 'Focus trap']}
              >
                <DialogSurface
                  triggerLabel={t('uiElements.dialog')}
                  title={t('uiElements.dialogTitle')}
                  description={t('uiElements.dialogDescription')}
                  cancelLabel={t('uiElements.cancel')}
                  confirmLabel={t('uiElements.confirm')}
                  defaultOpen={overlay === 'dialog'}
                  onConfirm={() => setLastAction(t('uiElements.confirm'))}
                >
                  <TextField label={t('uiElements.dialogField')} defaultValue="Community" />
                </DialogSurface>
              </ComponentPreview>
              <ComponentPreview
                name="DialogSurface · Form footer"
                description={t('uiElements.footerFormHint')}
                states={['Native form submit', 'Fixed actions', 'External pending', 'Focus return']}
              >
                <DialogSurface
                  triggerLabel={t('uiElements.footerForm')}
                  title={t('uiElements.footerForm')}
                  description={t('uiElements.footerFormHint')}
                  cancelLabel={t('uiElements.close')}
                  busy={formBusy}
                  footerAction={
                    <Action
                      form={footerFormId}
                      type="submit"
                      loading={formBusy}
                      disabled={formBusy}
                    >
                      {t('uiElements.confirm')}
                    </Action>
                  }
                >
                  <form
                    id={footerFormId}
                    onSubmit={(event) => {
                      event.preventDefault();
                      setFormBusy(true);
                    }}
                  >
                    <TextField label={t('uiElements.dialogField')} defaultValue="Community" />
                  </form>
                  {formBusy ? (
                    <div className="mt-4 space-y-3">
                      <p role="status">{t('uiElements.footerFormPending')}</p>
                      <Action variant="secondary" onPress={() => setFormBusy(false)}>
                        {t('uiElements.footerFormFinish')}
                      </Action>
                    </div>
                  ) : null}
                </DialogSurface>
              </ComponentPreview>
              <ComponentPreview
                name="DialogSurface · Workspace"
                description={t('uiElements.workspaceDialogHint')}
                states={['Reading space', 'Header close', 'Keyboard', 'Narrow viewport']}
              >
                <DialogSurface
                  triggerLabel={t('uiElements.workspaceDialog')}
                  title={t('uiElements.workspaceDialog')}
                  description={t('uiElements.workspaceDialogHint')}
                  cancelLabel={t('uiElements.close')}
                  layout="workspace"
                  size="cover"
                >
                  <div className="flex h-full min-h-0 flex-col gap-3">
                    <SearchBox
                      label={t('uiElements.searchLabel')}
                      placeholder={t('uiElements.searchLabel')}
                    />
                    <div className="grid min-h-0 flex-1 place-items-center rounded-panel bg-surface-muted p-4 text-ink-muted">
                      {t('uiElements.workspaceDialogContent')}
                    </div>
                  </div>
                </DialogSurface>
              </ComponentPreview>
              <ComponentPreview
                name="ConfirmDialog"
                description={t('uiElements.catalog.confirmDescription')}
                states={['Impact', 'Cancel', 'Confirm', 'Disabled', 'Pending', 'Failure']}
              >
                <ConfirmDialog
                  cancelLabel={t('uiElements.cancel')}
                  confirmLabel={t('uiElements.confirm')}
                  description={t('uiElements.catalog.confirmPrompt')}
                  failureMessage={t('uiElements.confirmFailure')}
                  impact={t('uiElements.catalog.confirmImpact')}
                  title={t('uiElements.catalog.confirmTitle')}
                  triggerLabel={t('uiElements.catalog.confirmTrigger')}
                  defaultOpen={overlay === 'confirm-primary'}
                  onConfirm={() => setLastAction(t('uiElements.confirm'))}
                />
              </ComponentPreview>
              <ComponentPreview
                name="DestructiveConfirmDialog"
                description={t('uiElements.catalog.destructiveConfirmDescription')}
                states={['Danger tone', 'Impact', 'Pending', 'Failure', 'Focus restore']}
              >
                <DestructiveConfirmDialog
                  cancelLabel={t('uiElements.cancel')}
                  confirmLabel={t('uiElements.destructiveAction')}
                  description={t('uiElements.destructiveDescription')}
                  failureMessage={t('uiElements.confirmFailure')}
                  impact={t('uiElements.destructiveImpact')}
                  title={t('uiElements.destructiveTitle')}
                  triggerLabel={t('uiElements.destructiveConfirm')}
                  defaultOpen={overlay === 'confirm'}
                  onConfirm={() => setLastAction(t('uiElements.destructiveAction'))}
                />
              </ComponentPreview>
              <ComponentPreview
                name="DrawerSurface"
                description={t('uiElements.catalog.drawerDescription')}
                states={['Right sheet', 'Header / body', 'Close', 'Scroll', 'Narrow viewport']}
              >
                <DrawerSurface
                  triggerLabel={t('uiElements.drawer')}
                  title={t('uiElements.drawerTitle')}
                  description={t('uiElements.drawerDescription')}
                  closeLabel={t('uiElements.close')}
                  defaultOpen={overlay === 'drawer'}
                >
                  <div className="space-y-4">
                    <TextField
                      label={t('uiElements.drawerField')}
                      defaultValue="Reference surface"
                    />
                    <SwitchField
                      label={t('uiElements.drawerSwitch')}
                      description={t('uiElements.drawerSwitchDescription')}
                      checked={checked}
                      onCheckedChange={setChecked}
                    />
                  </div>
                </DrawerSurface>
              </ComponentPreview>
              <ComponentPreview
                name="CommandMenu"
                description={t('uiElements.catalog.commandDescription')}
                states={['Search', 'Filtered', 'Empty', 'Keyboard action', 'Modal focus']}
              >
                <CommandMenu
                  triggerLabel={t('uiElements.command')}
                  title={t('uiElements.commandTitle')}
                  searchLabel={t('uiElements.commandSearchLabel')}
                  searchPlaceholder={t('uiElements.commandSearchPlaceholder')}
                  emptyLabel={t('uiElements.commandEmpty')}
                  defaultOpen={overlay === 'command'}
                  onAction={(id) => setLastAction(id)}
                  items={[
                    {
                      id: 'workspace',
                      label: t('uiElements.commandTargets.workspace.label'),
                      description: t('uiElements.commandTargets.workspace.description'),
                    },
                    {
                      id: 'form',
                      label: t('uiElements.commandTargets.form.label'),
                      description: t('uiElements.commandTargets.form.description'),
                    },
                    {
                      id: 'states',
                      label: t('uiElements.commandTargets.states.label'),
                      description: t('uiElements.commandTargets.states.description'),
                    },
                  ]}
                />
              </ComponentPreview>
            </div>
            {lastAction ? (
              <p className="border-t border-border px-5 py-3 text-sm text-ink-muted" role="status">
                {lastAction}
              </p>
            ) : null}
          </Section>
        </>
      )}
    </UiElementsFamilyPage>
  );
}

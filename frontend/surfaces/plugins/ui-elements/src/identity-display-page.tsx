'use client';

import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { Avatar, UserIdentity } from '@clouddrive/ui-adapter/identity';
import { ReadyImage } from '@clouddrive/ui-adapter/ready-image';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Section } from '@clouddrive/surface-foundation/layout';
import { ComponentPreview } from './component-preview';
import { UiElementsFamilyPage } from './family-page';

const avatarDemoUrl = '/avatar-demo.svg';
export function IdentityDisplayPage() {
  const { t } = useFrontendTranslation();
  return (
    <UiElementsFamilyPage
      familyId="identity-display"
      title={t('uiElements.catalog.identityDisplay')}
      description={t('uiElements.catalog.identityDisplayDescription')}
    >
      {({ longText }) => (
        <>
          <Section
            id="identity-display"
            title={t('uiElements.catalog.identityDisplay')}
            description={t('uiElements.catalog.identityDisplayDescription')}
          >
            <div data-reveal-items className="grid gap-4 p-5 lg:grid-cols-2">
              <ComponentPreview
                name="Avatar"
                description={t('uiElements.catalog.avatarDescription')}
                states={['Image', 'Fallback', 'sm / md / lg', '3 presence tones']}
              >
                <div className="flex flex-wrap items-end gap-5">
                  <Avatar name="Avery Morgan" size="sm" src={avatarDemoUrl} />
                  <Avatar
                    name="Rin"
                    presence={{ label: t('uiElements.presenceOnline'), tone: 'success' }}
                  />
                  <Avatar
                    name="Lin Chen"
                    size="lg"
                    presence={{ label: t('uiElements.catalog.presenceAway'), tone: 'warning' }}
                  />
                  <Avatar
                    name="Noah Williams"
                    size="lg"
                    presence={{ label: t('uiElements.catalog.presenceOffline'), tone: 'neutral' }}
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="UserIdentity"
                description={t('uiElements.catalog.userIdentityDescription')}
                states={['Image', 'Fallback', 'Presence', 'Optional description', 'Long content']}
              >
                <div className="grid gap-4">
                  <UserIdentity
                    avatarSrc={avatarDemoUrl}
                    description={t('uiElements.identityDescription')}
                    name="Avery Morgan"
                    presence={{ label: t('uiElements.presenceOnline'), tone: 'success' }}
                  />
                  <UserIdentity
                    description={longText ? t('uiElements.longDescription') : undefined}
                    name="Lin Chen with an intentionally long display name"
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                fullWidth
                name="ReadyImage"
                description={t('uiElements.additional.readyImage')}
                states={['Loading', 'Decoded', 'Error', 'Reserved layout', 'cover / contain']}
              >
                <ReadyImage
                  alt={t('uiElements.additional.mediaAlt')}
                  error={
                    <span className="grid size-full place-items-center text-sm text-danger">
                      {t('uiElements.additional.imageError')}
                    </span>
                  }
                  height={160}
                  src={avatarDemoUrl}
                  width={240}
                />
              </ComponentPreview>
              <ComponentPreview
                fullWidth
                name="DescriptionList"
                description={t('uiElements.catalog.descriptionListDescription')}
                states={['1 / 2 columns', 'Missing value', 'Long content', 'Narrow reflow']}
              >
                <DescriptionList
                  columns={2}
                  label={t('uiElements.descriptionListLabel')}
                  items={[
                    {
                      id: 'role',
                      term: t('uiElements.roleTerm'),
                      description: t('uiElements.identityDescription'),
                    },
                    {
                      id: 'region',
                      term: t('uiElements.regionTerm'),
                      description: t('uiElements.regionApac'),
                    },
                    {
                      id: 'owner',
                      term: t('uiElements.dataTableColumns.owner'),
                      description: longText ? t('uiElements.longDescription') : 'Avery Morgan',
                    },
                    {
                      id: 'optional',
                      term: t('uiElements.catalog.optionalValue'),
                      description: undefined,
                    },
                  ]}
                />
              </ComponentPreview>
            </div>
          </Section>
        </>
      )}
    </UiElementsFamilyPage>
  );
}

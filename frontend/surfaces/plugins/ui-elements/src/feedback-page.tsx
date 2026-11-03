'use client';

import { Action } from '@clouddrive/ui-adapter/action';
import { AlertBanner, Badge, NotificationCard } from '@clouddrive/ui-adapter/feedback';
import { FeedbackPresence } from '@clouddrive/ui-adapter/feedback-presence';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { AlertTriangle, Bell, CheckCircle2, ChevronRight, Info, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Section } from '@clouddrive/surface-foundation/layout';
import { ComponentPreview } from './component-preview';
import { UiElementsFamilyPage } from './family-page';
export function FeedbackPage() {
  const { t } = useFrontendTranslation();
  const { notify } = useFeedback();
  const searchParams = useSearchParams();
  const [notificationVisible, setNotificationVisible] = useState(true);
  const [alertVisible, setAlertVisible] = useState(true);
  const directToastSent = useRef(false);
  const overlay = searchParams.get('overlay');
  useEffect(() => {
    if (overlay !== 'toast' || directToastSent.current) return;
    directToastSent.current = true;
    notify({
      title: t('uiElements.toastTitle'),
      description: t('uiElements.toastDescription'),
      tone: 'info',
    });
  }, [notify, overlay, t]);
  return (
    <UiElementsFamilyPage
      familyId="feedback"
      title={t('uiElements.feedbackTitle')}
      description={t('uiElements.feedbackDescription')}
    >
      {({ description, longText, setLongText }) => (
        <>
          <Section
            id="feedback"
            title={t('uiElements.feedbackTitle')}
            description={t('uiElements.feedbackDescription')}
          >
            <div data-reveal-items className="grid gap-4 p-5 lg:grid-cols-2">
              <ComponentPreview
                fullWidth
                name="AlertBanner"
                description={t('uiElements.catalog.alertDescription')}
                states={[
                  'Info',
                  'Success',
                  'Warning',
                  'Danger',
                  'Action',
                  'Dismiss',
                  'Announcement',
                ]}
              >
                <div className="grid gap-3 lg:grid-cols-2">
                  <FeedbackPresence visible={alertVisible}>
                    <AlertBanner
                      tone="success"
                      icon={<CheckCircle2 className="size-5" />}
                      title={t('uiElements.successAlertTitle')}
                      description={description}
                      dismissLabel={t('uiElements.alertDismiss')}
                      onDismiss={() => setAlertVisible(false)}
                    />
                  </FeedbackPresence>
                  {!alertVisible ? (
                    <Action variant="quiet" onPress={() => setAlertVisible(true)}>
                      {t('uiElements.alertRestore')}
                    </Action>
                  ) : null}
                  <AlertBanner
                    tone="warning"
                    icon={<AlertTriangle className="size-5" />}
                    title={t('uiElements.warningAlertTitle')}
                    description={t('uiElements.warningAlertDescription')}
                    actionLabel={t('uiElements.reviewAction')}
                    onAction={() => setLongText(true)}
                  />
                  <AlertBanner
                    tone="info"
                    icon={<Info className="size-5" />}
                    title={t('uiElements.catalog.infoAlertTitle')}
                    description={description}
                  />
                  <AlertBanner
                    tone="danger"
                    icon={<XCircle className="size-5" />}
                    title={t('uiElements.catalog.dangerAlertTitle')}
                    description={t('uiElements.catalog.dangerAlertDescription')}
                    announcement="urgent"
                  />
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="Badge"
                description={t('uiElements.catalog.badgeDescription')}
                states={[
                  'Soft',
                  'Solid',
                  'sm / md',
                  '5 tones',
                  'Leading / trailing icon',
                  'Long content',
                ]}
              >
                <div className="flex flex-wrap gap-2" aria-label={t('uiElements.badgesLabel')}>
                  <Badge leadingIcon={<CheckCircle2 className="size-3.5" />} tone="success">
                    {t('uiElements.successStatus')}
                  </Badge>
                  <Badge tone="warning">{t('uiElements.warningStatus')}</Badge>
                  <Badge tone="danger" appearance="solid">
                    {t('uiElements.dangerStatus')}
                  </Badge>
                  <Badge tone="info" appearance="solid" size="md">
                    {t('uiElements.infoStatus')}
                  </Badge>
                  <Badge trailingIcon={<ChevronRight className="size-3.5" />}>
                    {longText ? t('uiElements.longDescription') : t('uiElements.defaultStatus')}
                  </Badge>
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="NotificationCard"
                description={t('uiElements.catalog.notificationDescription')}
                states={['Primary action', 'Secondary action', 'Dismiss', 'Long content']}
              >
                <FeedbackPresence visible={notificationVisible}>
                  <NotificationCard
                    icon={<Bell className="size-5" />}
                    title={t('uiElements.notificationTitle')}
                    description={t('uiElements.notificationDescription')}
                    primaryActionLabel={t('uiElements.notificationPrimary')}
                    secondaryActionLabel={t('uiElements.notificationSecondary')}
                    dismissLabel={t('uiElements.notificationDismiss')}
                    onPrimaryAction={() => setLongText(true)}
                    onSecondaryAction={() => setNotificationVisible(false)}
                    onDismiss={() => setNotificationVisible(false)}
                  />
                </FeedbackPresence>
                {!notificationVisible ? (
                  <AlertBanner
                    tone="info"
                    icon={<Bell className="size-5" />}
                    title={t('uiElements.notificationDismissedTitle')}
                    description={t('uiElements.notificationDismissedDescription')}
                    actionLabel={t('uiElements.notificationRestore')}
                    onAction={() => setNotificationVisible(true)}
                  />
                ) : null}
              </ComponentPreview>
              <ComponentPreview
                fullWidth
                name="FeedbackProvider / Toast"
                description={t('uiElements.catalog.toastDescription')}
                states={['Info', 'Success', 'Warning', 'Danger', 'Queue', 'Action', 'Dismiss']}
              >
                <div className="flex flex-wrap gap-2">
                  {(['info', 'success', 'warning', 'danger'] as const).map((tone) => (
                    <Action
                      key={tone}
                      size="sm"
                      variant={tone === 'danger' ? 'danger' : 'secondary'}
                      onPress={() =>
                        notify({
                          title: `${t('uiElements.toastTitle')} · ${tone}`,
                          description: t('uiElements.toastDescription'),
                          tone,
                        })
                      }
                    >
                      {tone}
                    </Action>
                  ))}
                </div>
              </ComponentPreview>
            </div>
          </Section>
        </>
      )}
    </UiElementsFamilyPage>
  );
}

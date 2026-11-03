'use client';

import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { FileQuestion } from 'lucide-react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import { proceedAfterLeaveConfirm } from '../host/leave-confirm';
import { useFrontendTranslation } from '@clouddrive/i18n';

const AuthFrame = dynamic(() => import('../auth/frame').then((module) => module.AuthFrame), {
  ssr: false,
});

export default function NotFoundPage() {
  const router = useRouter();
  const { t } = useFrontendTranslation();
  return (
    <AuthFrame>
      <StateSurface
        actionLabel={t('auth.enterWorkspace')}
        description={t('auth.notFoundDescription')}
        icon={<FileQuestion className="size-5" />}
        state="empty"
        title={t('auth.notFoundTitle')}
        onAction={() => {
          void proceedAfterLeaveConfirm('/').then((proceed) => {
            if (proceed) void router.replace('/');
          });
        }}
      />
    </AuthFrame>
  );
}

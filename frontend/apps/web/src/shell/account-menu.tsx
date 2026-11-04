'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { Avatar, UserIdentity } from '@clouddrive/ui-adapter/identity';
import { MenuButton } from '@clouddrive/ui-adapter/menu-button';
import {
  ChevronDown,
  Languages,
  LockKeyhole,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../auth/context';
import { useShellStore } from '../state/use-shell-store';

export function AccountMenu({
  compact,
  presentation = 'identity',
  onNavigate,
}: Readonly<{
  compact: boolean;
  presentation?: 'identity' | 'avatar';
  onNavigate: (destination: 'settings' | 'account' | 'lock-screen') => void;
}>) {
  const { t } = useFrontendTranslation();
  const auth = useAuth();
  const user = auth.session?.user;
  const locale = useShellStore((state) => state.locale);
  const themeMode = useShellStore((state) => state.preferences.appearance.themeMode);
  const setLocale = useShellStore((state) => state.setLocale);
  const updateCategory = useShellStore((state) => state.updateCategory);
  const languageName = t(
    locale === 'zh-CN' ? 'shell.accountMenu.chinese' : 'shell.accountMenu.english',
  );
  const themeNames = {
    light: t('shell.accountMenu.light'),
    dark: t('shell.accountMenu.dark'),
    system: t('shell.accountMenu.system'),
  };
  if (!user) return null;
  return (
    <MenuButton
      ariaLabel={t('shell.account')}
      submenuLayout={compact ? 'stacked' : 'adjacent'}
      label={
        presentation === 'avatar' ? (
          <Avatar name={user.name} size="sm" />
        ) : (
          <>
            <span className="md:hidden">
              <Avatar name={user.name} size="sm" />
            </span>
            <span className="hidden md:inline-flex">
              <UserIdentity avatarSize="sm" name={user.name} />
            </span>
            <ChevronDown aria-hidden="true" className="hidden size-3.5 text-ink-muted md:block" />
          </>
        )
      }
      header={
        <div className="flex items-center gap-3">
          <span aria-hidden="true">
            <Avatar name={user.name} size="sm" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="mt-0.5 truncate text-xs font-normal text-ink-muted">{user.email}</p>
          </div>
        </div>
      }
      groups={[
        {
          id: 'preferences',
          label: t('shell.accountMenu.preferences'),
          items: [
            {
              id: 'language',
              label: t('shell.accountMenu.language'),
              value: languageName,
              selectedId: `locale:${locale}`,
              icon: <Languages className="size-4" />,
              options: [
                { id: 'locale:zh-CN', label: t('shell.accountMenu.chinese') },
                { id: 'locale:en', label: t('shell.accountMenu.english') },
              ],
            },
            {
              id: 'appearance',
              label: t('shell.accountMenu.appearance'),
              value: themeNames[themeMode],
              selectedId: `theme:${themeMode}`,
              icon:
                themeMode === 'system' ? (
                  <Monitor className="size-4" />
                ) : themeMode === 'dark' ? (
                  <Moon className="size-4" />
                ) : (
                  <Sun className="size-4" />
                ),
              options: [
                { id: 'theme:light', label: themeNames.light, icon: <Sun className="size-4" /> },
                { id: 'theme:dark', label: themeNames.dark, icon: <Moon className="size-4" /> },
                {
                  id: 'theme:system',
                  label: themeNames.system,
                  icon: <Monitor className="size-4" />,
                },
              ],
            },
          ],
        },
        {
          id: 'application',
          label: t('shell.accountMenu.application'),
          items: [
            {
              id: 'account',
              label: t('shell.accountMenu.profile'),
              icon: <UserRound className="size-4" />,
            },
            { id: 'settings', label: t('nav.settings'), icon: <Settings className="size-4" /> },
            {
              id: 'lock-screen',
              label: t('shell.lock.action'),
              icon: <LockKeyhole className="size-4" />,
            },
            { id: 'logout', label: t('auth.logout'), icon: <LogOut className="size-4" /> },
          ],
        },
      ]}
      onAction={(id) => {
        if (id === 'locale:zh-CN' || id === 'locale:en')
          setLocale(id === 'locale:en' ? 'en' : 'zh-CN');
        else if (id === 'theme:light' || id === 'theme:dark' || id === 'theme:system')
          updateCategory('appearance', {
            themeMode: id === 'theme:system' ? 'system' : id === 'theme:dark' ? 'dark' : 'light',
          });
        else if (id === 'settings' || id === 'account' || id === 'lock-screen') onNavigate(id);
        else if (id === 'logout')
          void auth.logout().then((success) => {
            if (success) window.location.replace('/login');
          });
      }}
    />
  );
}

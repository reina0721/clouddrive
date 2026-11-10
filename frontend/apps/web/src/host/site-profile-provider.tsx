'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SiteProfileProvider } from '@clouddrive/surface/administration/runtime';
import type { SiteProfile, SiteProfileVersion } from '@clouddrive/surface/administration';
import { readAuthConfig } from '../auth/config';

export function RuntimeSiteProfile({
  children,
  theme,
}: Readonly<{ children: ReactNode; theme: 'light' | 'dark' }>) {
  const [profile, setProfile] = useState<SiteProfile | null>(null);
  const saveGeneration = useRef(0);
  const client = useMemo(() => {
    try {
      const config = readAuthConfig();
      if (config.mode === 'backend') {
        const endpoint = config.apiBaseUrl;
        return () =>
          import('./site-profile-client').then(({ createSiteProfileClient }) =>
            createSiteProfileClient(endpoint),
          );
      }
    } catch {
      // 认证宿主负责呈现部署配置错误。
    }
    return null;
  }, []);
  const admin = useMemo(
    () =>
      client && {
        read: async (signal?: AbortSignal) => (await client()).read(signal),
        save: async (value: SiteProfileVersion) => {
          const saved = await (await client()).save(value);
          saveGeneration.current++;
          setProfile(saved.profile);
          return saved;
        },
      },
    [client],
  );
  useEffect(() => {
    if (!client) return;
    const controller = new AbortController();
    const generation = saveGeneration.current;
    void client()
      .then((port) => port.publicProfile(controller.signal))
      .then(
        (value) => {
          if (!controller.signal.aborted && generation === saveGeneration.current)
            setProfile(value);
        },
        () => {
          // 可选展示信息失败时，登录与文件访问继续使用默认品牌。
        },
      );
    return () => controller.abort();
  }, [client]);
  return (
    <SiteProfileProvider value={{ profile, theme, admin }}>
      <title>{profile?.name || 'clouddrive'}</title>
      <meta name="description" content={profile?.description || 'clouddrive 管理工作区'} />
      {profile?.icon ? <link rel="icon" href={profile.icon} referrerPolicy="no-referrer" /> : null}
      {children}
    </SiteProfileProvider>
  );
}

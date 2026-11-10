'use client';
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState, type ReactNode } from 'react';
import type {
  SiteAddresses,
  SiteProfile,
  SiteProfileManagement,
  SiteProfileVersion,
} from './site-profile';

type SiteProfileAdmin = Readonly<{
  read(signal?: AbortSignal): Promise<SiteProfileManagement>;
  save(value: SiteProfileVersion): Promise<SiteProfileManagement>;
}>;

const SiteProfileContext = createContext<
  Readonly<{
    profile: SiteProfile | null;
    theme: 'light' | 'dark';
    admin: SiteProfileAdmin | null;
    readPublishedAddresses: ((signal: AbortSignal) => Promise<SiteAddresses | undefined>) | null;
  }>
>({ profile: null, theme: 'light', admin: null, readPublishedAddresses: null });

export const SiteProfileProvider = SiteProfileContext.Provider;

export function useSiteProfile() {
  return useContext(SiteProfileContext);
}

/** publishedSiteOrigin 只选择由站点信息接口发布的地址。 */
export function publishedSiteOrigin(
  site: SiteAddresses | undefined,
  current: string,
  purpose: 'links' | 'callback',
) {
  if (!site?.primary) return current;
  if (purpose === 'links' && (current === site.primary || site.alternatives.includes(current)))
    return current;
  return site.primary;
}

export function SiteLogo({
  src,
  fallback,
  className,
}: Readonly<{ src: string; fallback: ReactNode; className: string }>) {
  const [failed, setFailed] = useState('');
  return src && failed !== src ? (
    <img
      src={src}
      alt=""
      className={className + ' object-contain'}
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
    />
  ) : (
    fallback
  );
}

export function CurrentSiteLogo({
  fallback,
  className,
}: Readonly<{ fallback: ReactNode; className: string }>) {
  const { profile, theme } = useSiteProfile();
  const src = theme === 'dark' ? profile?.darkLogo || profile?.lightLogo : profile?.lightLogo;
  return <SiteLogo key={src} src={src ?? ''} fallback={fallback} className={className} />;
}

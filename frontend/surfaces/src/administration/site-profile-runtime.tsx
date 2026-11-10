'use client';
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { SiteProfile, SiteProfileVersion } from './site-profile';

type SiteProfileAdmin = Readonly<{
  read(signal?: AbortSignal): Promise<SiteProfileVersion>;
  save(value: SiteProfileVersion): Promise<SiteProfileVersion>;
}>;

const SiteProfileContext = createContext<
  Readonly<{
    profile: SiteProfile | null;
    theme: 'light' | 'dark';
    admin: SiteProfileAdmin | null;
  }>
>({ profile: null, theme: 'light', admin: null });

export const SiteProfileProvider = SiteProfileContext.Provider;

export function useSiteProfile() {
  return useContext(SiteProfileContext);
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

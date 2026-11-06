import {
  instantWallTime,
  wallTimeInstant,
  type TimeOccurrence,
  type WallTimeResult,
} from '@clouddrive/i18n/temporal';

export type ShareExpiryDraft = Readonly<{
  mode: 'default' | 'keep' | '1' | '24' | '168' | '720' | 'custom';
  day: string;
  clock: string;
  timeZone: string;
  occurrence: TimeOccurrence;
}>;
const millisecondsPerHour = 60 * 60 * 1000;
const defaultExpiryHours = 24;
export function initialShareExpiry(timeZone: string, current?: string): ShareExpiryDraft {
  const value =
    current ?? new Date(Date.now() + defaultExpiryHours * millisecondsPerHour).toISOString();
  return {
    mode: current ? 'keep' : 'default',
    ...instantWallTime(value, timeZone),
    occurrence: 'reject',
  };
}
export type ShareExpiryResult =
  Readonly<{ ok: true; value: string | undefined }> | Exclude<WallTimeResult, { ok: true }>;
export function resolveShareExpiry(draft: ShareExpiryDraft, current?: string): ShareExpiryResult {
  if (draft.mode === 'default') return { ok: true, value: undefined };
  if (draft.mode === 'keep')
    return current ? { ok: true, value: current } : { ok: false, code: 'invalid' };
  if (draft.mode === 'custom') {
    const result = wallTimeInstant(draft, draft.occurrence);
    return result.ok ? { ok: true, value: result.instant } : result;
  }
  return {
    ok: true,
    value: new Date(Date.now() + Number(draft.mode) * millisecondsPerHour).toISOString(),
  };
}

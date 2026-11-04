export type ShareExpiryDraft = Readonly<{
  mode: 'default' | 'keep' | '1' | '24' | '168' | '720' | 'custom';
  day: string;
  clock: string;
}>;
const millisecondsPerHour = 60 * 60 * 1000;
export function initialShareExpiry(current?: string): ShareExpiryDraft {
  const value = current ?? new Date(Date.now() + 24 * millisecondsPerHour).toISOString();
  return {
    mode: current ? 'keep' : 'default',
    day: value.slice(0, 10),
    clock: value.slice(11, 16),
  };
}
export function shareExpiryValue(draft: ShareExpiryDraft, current?: string): string | undefined {
  if (draft.mode === 'default') return undefined;
  if (draft.mode === 'keep') return current;
  if (draft.mode === 'custom') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.clock))
      return '';
    const value = new Date(draft.day + 'T' + draft.clock + ':00.000Z');
    return Number.isFinite(value.getTime()) ? value.toISOString() : '';
  }
  return new Date(Date.now() + Number(draft.mode) * millisecondsPerHour).toISOString();
}

import { z } from 'zod';
import type { StoragePolicy, StoragePolicyInput } from '../../../src/files/storage-policy';

export const limitFields = ['maxFileBytes', 'chunkBytes'] as const;
export const byteUnits = ['B', 'KiB', 'MiB', 'GiB'] as const;
export type ByteUnit = (typeof byteUnits)[number];
const factors = { B: 1n, KiB: 1024n, MiB: 1048576n, GiB: 1073741824n } as const;
export type LimitDraft = { inherit: boolean; amount: string; unit: ByteUnit };
export type LimitsDraft = Record<(typeof limitFields)[number], LimitDraft>;

/** 十进制输入精确换算为整数字节，拒绝舍入、科学计数和超出安全范围的值。 */
export function parseByteAmount(raw: string, unit: ByteUnit): number | undefined {
  const value = raw.trim();
  if (value.length > 64 || !/^\d+(?:\.\d+)?$/.test(value)) return undefined;
  const [whole = '', fraction = ''] = value.split('.');
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole + fraction) * factors[unit];
  if (numerator % denominator !== 0n) return undefined;
  const bytes = numerator / denominator;
  return bytes > 0n && bytes <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(bytes) : undefined;
}

/** 二进制单位的有限十进制展开，不经过浮点数格式化。 */
export function byteAmount(bytes: number, unit: ByteUnit): string {
  const divisor = factors[unit];
  const value = BigInt(bytes);
  let remainder = value % divisor;
  let fraction = '';
  while (remainder !== 0n) {
    remainder *= 10n;
    fraction += String(remainder / divisor);
    remainder %= divisor;
  }
  return String(value / divisor) + (fraction ? '.' + fraction : '');
}

export function changeByteUnit(draft: LimitDraft, unit: ByteUnit): LimitDraft {
  const bytes = parseByteAmount(draft.amount, draft.unit);
  return { ...draft, unit, amount: bytes === undefined ? draft.amount : byteAmount(bytes, unit) };
}

export function byteUnitFor(bytes: number): ByteUnit {
  return (
    [...byteUnits]
      .reverse()
      .find(
        (unit) =>
          BigInt(bytes) >= factors[unit] &&
          (byteAmount(bytes, unit).split('.')[1]?.length ?? 0) <= 3,
      ) ?? 'B'
  );
}

export function storageLimitsDraft(
  view: Pick<StoragePolicy, 'defaults' | 'overrides'>,
): LimitsDraft {
  function draft(key: (typeof limitFields)[number]): LimitDraft {
    const override = view.overrides[key];
    const bytes = override ?? view.defaults[key];
    const unit = byteUnitFor(bytes);
    return { inherit: override === undefined, amount: byteAmount(bytes, unit), unit };
  }
  return { maxFileBytes: draft('maxFileBytes'), chunkBytes: draft('chunkBytes') };
}

export function storageLimitsSchema(defaults: StoragePolicy['defaults']) {
  const limit = z.object({ inherit: z.boolean(), amount: z.string(), unit: z.enum(byteUnits) });
  return z.object({ maxFileBytes: limit, chunkBytes: limit }).superRefine((draft, context) => {
    for (const key of limitFields) {
      if (draft[key].inherit) continue;
      const value = parseByteAmount(draft[key].amount, draft[key].unit);
      if (value === undefined || value > defaults[key])
        context.addIssue({ code: 'custom', path: [key, 'amount'], message: 'invalidLimit' });
    }
  });
}

export function storageLimitOverrides(draft: LimitsDraft): StoragePolicyInput['overrides'] {
  const overrides: StoragePolicyInput['overrides'] = {};
  for (const key of limitFields) {
    if (draft[key].inherit) continue;
    const value = parseByteAmount(draft[key].amount, draft[key].unit);
    if (value === undefined) throw new Error('Storage limit form must be validated before saving.');
    overrides[key] = value;
  }
  return overrides;
}

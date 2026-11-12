import { expect, it } from 'vitest';
import {
  byteAmount,
  byteUnits,
  changeByteUnit,
  parseByteAmount,
  storageLimitOverrides,
  storageLimitsDraft,
  storageLimitsSchema,
} from './storage-limit-form';

it('大小输入保留整数字节精度，不接受静默舍入或危险范围', () => {
  expect(parseByteAmount('1.5', 'MiB')).toBe(1572864);
  expect(parseByteAmount('0.0009765625', 'KiB')).toBe(1);
  for (const value of ['0', '-1', '1e3', 'NaN', '1.1', '9007199254740992'])
    expect(parseByteAmount(value, 'B')).toBeUndefined();
  expect(parseByteAmount('1.1', 'KiB')).toBeUndefined();
});

it('切换单位往返保留任意安全整数字节，包括不能短写的值', () => {
  for (const bytes of [1, 1025, 536870911, Number.MAX_SAFE_INTEGER])
    for (const unit of byteUnits)
      expect(parseByteAmount(byteAmount(bytes, unit), unit)).toBe(bytes);
  expect(changeByteUnit({ inherit: false, amount: '512', unit: 'MiB' }, 'GiB')).toEqual({
    inherit: false,
    amount: '0.5',
    unit: 'GiB',
  });
});

it('继承和显式限额分别保存，并以部署硬上限校验', () => {
  const defaults = { maxFileBytes: 1048576, chunkBytes: 1024 };
  const draft = storageLimitsDraft({ defaults, overrides: { chunkBytes: 512 } });
  expect(draft.maxFileBytes).toEqual({ inherit: true, amount: '1', unit: 'MiB' });
  expect(storageLimitOverrides(draft)).toEqual({ chunkBytes: 512 });
  expect(storageLimitsSchema(defaults).safeParse(draft).success).toBe(true);
  const changed = { ...draft, chunkBytes: { inherit: false, amount: '2', unit: 'KiB' as const } };
  expect(storageLimitsSchema(defaults).safeParse(changed).success).toBe(false);
  expect(
    storageLimitOverrides({ ...draft, chunkBytes: { ...draft.chunkBytes, inherit: true } }),
  ).toEqual({});
});

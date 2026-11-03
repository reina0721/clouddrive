import { describe, expect, it } from 'vitest';
import { securityAuditPageSchema } from './model';

describe('Native audit response', () => {
  it('accepts the native numeric event identifier and preserves the UI row key', () => {
    const value = {
      items: [
        {
          eventId: 26,
          operation: 'auth.audit.list',
          decision: 'allowed',
          outcome: 'succeeded',
          occurredAt: '2026-11-03T22:03:17Z',
        },
      ],
      hasMore: false,
    };
    expect(securityAuditPageSchema.parse(value).items[0]?.eventId).toBe('26');
    expect(
      securityAuditPageSchema.safeParse({ ...value, items: [{ ...value.items[0], eventId: null }] })
        .success,
    ).toBe(false);
  });
});

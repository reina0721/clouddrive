import { z } from 'zod';
import { identifierSchema } from './model';
export const accountSessionSchema = z
  .object({
    id: identifierSchema,
    device: z.string().min(1).max(200),
    createdAt: z.string().datetime(),
    lastActiveAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    current: z.boolean(),
  })
  .strict();
export const accountSessionsSchema = z
  .object({
    items: z
      .array(accountSessionSchema)
      .refine(
        (items) =>
          new Set(items.map((item) => item.id)).size === items.length &&
          items.filter((item) => item.current).length === 1,
      ),
  })
  .strict();
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(1).max(128) })
  .strict()
  .refine((input) => input.currentPassword !== input.newPassword, { path: ['newPassword'] });

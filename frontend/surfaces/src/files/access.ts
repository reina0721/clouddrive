import { z } from 'zod';
import { fileEntrySchema } from './model';
import { shareAudienceSchema, sharePermissionsSchema } from './sharing';

export const fileAccessPolicySchema = z.object({
  default: sharePermissionsSchema,
  audience: shareAudienceSchema,
});
export type FileAccessPolicy = z.infer<typeof fileAccessPolicySchema>;
export const audienceTargetSchema = z.object({ id: z.string().uuid(), label: z.string() });
export type AudienceTarget = z.infer<typeof audienceTargetSchema>;
export type AudienceKind = 'account' | 'role';
const accessSourceSchema = z.object({ id: z.string().uuid(), name: z.string() });
export const fileAccessDetailSchema = z.object({
  entry: fileEntrySchema,
  revision: z.number().int().nonnegative().safe(),
  policy: fileAccessPolicySchema.nullable(),
  inheritedFrom: accessSourceSchema.nullable(),
  shares: z
    .array(z.object({ id: z.string().uuid(), title: z.string(), rootName: z.string() }))
    .max(200),
  maxRules: z.number().int().positive().max(32),
});
export type FileAccessDetail = z.infer<typeof fileAccessDetailSchema>;
export const effectiveFileAccessSchema = z.object({
  permissions: sharePermissionsSchema,
  reason: z.enum([
    'owner',
    'administrator',
    'account',
    'role',
    'authenticated',
    'anonymous',
    'default',
  ]),
  source: accessSourceSchema.nullable(),
});
export type EffectiveFileAccess = z.infer<typeof effectiveFileAccessSchema>;
export type FileAccessPort = Readonly<{
  read(id: string, signal?: AbortSignal): Promise<FileAccessDetail>;
  update(
    id: string,
    input: Readonly<{ revision: number; policy: FileAccessPolicy | null }>,
  ): Promise<FileAccessDetail>;
  lookup(kind: AudienceKind, key: string, signal?: AbortSignal): Promise<AudienceTarget>;
  preview(
    id: string,
    shareId: string,
    accountId: string,
    signal?: AbortSignal,
  ): Promise<EffectiveFileAccess>;
}>;

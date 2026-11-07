import { z } from 'zod';

const positiveBytes = z.number().int().positive();
const limits = z.object({ maxFileBytes: positiveBytes, chunkBytes: positiveBytes });
const policyInput = z.object({
  revision: z.number().int().nonnegative(),
  overrides: limits.partial(),
});
export const storagePolicySchema = policyInput.extend({
  backend: z.enum(['disabled', 'local', 's3', 'minio']),
  defaults: limits,
  configured: limits,
  active: limits,
  pendingRestart: z.boolean(),
  canSave: z.boolean(),
});
const count = z.number().int().nonnegative();
export const storageUsageSchema = z.object({
  blobCount: count,
  blobBytes: count,
  currentReferences: count,
  historyReferences: count,
  pendingCount: count,
  pendingBytes: count,
  checkedAt: z.string(),
});
export type StoragePolicy = z.infer<typeof storagePolicySchema>;
export type StoragePolicyInput = z.infer<typeof policyInput>;
export type StorageUsage = z.infer<typeof storageUsageSchema>;

const ruleMode = z.enum(['allow', 'deny']);
const storageNameRules = z.object({
  extensionMode: ruleMode,
  extensions: z.array(z.string()).max(32),
  patternMode: ruleMode,
  pattern: z.string(),
});
const storageNameRuleInput = z.object({
  revision: z.number().int().nonnegative(),
  rules: storageNameRules,
});
export const storageNameRulesViewSchema = storageNameRuleInput.extend({
  active: storageNameRules,
  pendingRestart: z.boolean(),
  canSave: z.boolean(),
});
export const storageNameRuleCheckSchema = z.object({
  decision: z.enum(['allowed', 'extension', 'pattern']),
});
export type StorageNameRules = z.infer<typeof storageNameRules>;
export type StorageNameRuleInput = z.infer<typeof storageNameRuleInput>;
export type StorageNameRulesView = z.infer<typeof storageNameRulesViewSchema>;
export type StorageNameRuleCheck = z.infer<typeof storageNameRuleCheckSchema>;

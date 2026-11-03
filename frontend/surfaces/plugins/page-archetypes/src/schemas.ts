import { z } from 'zod';

export const referenceFormSchema = z.object({
  name: z.string().trim().min(3).max(80),
  owner: z.string().trim().min(2).max(60),
  region: z.enum(['apac', 'emea', 'americas']),
  mode: z.enum(['observe', 'guided', 'automatic']),
  description: z.string().trim().min(20).max(600),
  reviewDate: z.string().min(1),
  notifyReviewers: z.boolean(),
  allowOfflineDraft: z.boolean(),
});

export type ReferenceFormInput = z.infer<typeof referenceFormSchema>;

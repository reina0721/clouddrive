import { z } from 'zod';

export const resourceFormSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(['sample', 'guide', 'template']),
});
export type ResourceFormValues = z.infer<typeof resourceFormSchema>;

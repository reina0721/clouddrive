import { z } from 'zod';

export const setupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(15).max(128),
  setupToken: z.string().min(1).max(512),
});
export type SetupValues = z.infer<typeof setupSchema>;

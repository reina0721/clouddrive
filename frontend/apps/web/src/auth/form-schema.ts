import { z } from 'zod';

export type AuthFormValues = {
  name: string;
  email: string;
  password: string;
  confirmation: string;
};
export function createAuthSchema(register: boolean) {
  return z
    .object({
      name: register ? z.string().trim().min(1).max(80) : z.string(),
      email: z.string().trim().email().max(254),
      password: z
        .string()
        .min(register ? 15 : 1)
        .max(128),
      confirmation: z.string(),
    })
    .refine((values) => !register || values.password === values.confirmation, {
      path: ['confirmation'],
    });
}

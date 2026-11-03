import { z } from 'zod';
import { createUserSchema } from './model';
export const profileEditorSchema = createUserSchema.extend({ password: z.literal('') });

import { z } from 'zod';
import { menuSchema } from '@clouddrive/surface/administration';
import { createJsonClient } from '../api/json-client';

const response = z.object({ items: z.array(menuSchema) });
export async function loadNavigation(base: string) {
  return response.parse(await createJsonClient(base)('/navigation'));
}

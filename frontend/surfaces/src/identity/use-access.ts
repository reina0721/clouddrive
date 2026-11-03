'use client';
import { useIdentityQuery } from './use-query';
/** Current authorization awareness for product navigation; servers still authorize every request. */
export function useProductAccess() {
  const result = useIdentityQuery('product.access', (port) => port.access());
  return { ...result, data: result.loading ? null : result.data };
}

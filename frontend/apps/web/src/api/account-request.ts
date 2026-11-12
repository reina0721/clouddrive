import { ApiError } from './json-client';

/** Bind every network send (including CSRF) to the initiating account. */
export function createAccountRequest(
  currentOwner: () => string | null,
  expectedOwner: string | null,
  request: typeof fetch = fetch,
): typeof fetch {
  const assertOwner = () => {
    if (!expectedOwner || currentOwner() !== expectedOwner) throw new ApiError('http', 401);
  };
  return async (input, init) => {
    assertOwner();
    try {
      return await request(input, init);
    } finally {
      assertOwner();
    }
  };
}

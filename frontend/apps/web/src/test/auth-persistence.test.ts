import { afterEach, expect, it } from 'vitest';
import { createBrowserMockRepository } from '../auth/mock-repository';
const key = 'clouddrive.auth-mock';
afterEach(() => window.localStorage.removeItem(key));

it('reads fresh persisted identity after external writes and deletion', async () => {
  const repository = createBrowserMockRepository();
  expect(await repository.readSession()).toBeNull();
  const session = {
    user: { id: 'one', name: 'One', email: 'one@example.test' },
    expiresAt: Date.now() + 60_000,
  };
  await repository.saveSession(session);
  expect(await repository.readSession()).toEqual(session);
  const other = { ...session, user: { ...session.user, id: 'two' } };
  window.localStorage.setItem(
    key,
    JSON.stringify({ version: 1, state: { accounts: [], session: other } }),
  );
  expect(await repository.readSession()).toEqual(other);
  window.localStorage.removeItem(key);
  expect(await repository.readSession()).toBeNull();
});

it('reports corrupt records without overwriting them and can recover after explicit repair', async () => {
  const repository = createBrowserMockRepository();
  window.localStorage.setItem(key, 'corrupt');
  await expect(repository.readSession()).rejects.toMatchObject({ code: 'protocol' });
  expect(window.localStorage.getItem(key)).toBe('corrupt');
  window.localStorage.removeItem(key);
  expect(await repository.readSession()).toBeNull();
  window.localStorage.setItem(
    key,
    JSON.stringify({ version: 1, state: { accounts: [], session: { user: { id: 'malformed' } } } }),
  );
  await expect(repository.readSession()).rejects.toMatchObject({ code: 'protocol' });
});

it('rejects duplicate writes and unknown persistence versions without discarding accounts', async () => {
  const repository = createBrowserMockRepository();
  const account = {
    user: { id: 'one', name: 'One', email: 'one@example.test' },
    salt: 'salt',
    digest: 'a'.repeat(64),
  };
  await repository.saveAccount(account);
  await expect(repository.saveAccount(account)).rejects.toMatchObject({ code: 'account-exists' });
  expect(await repository.readAccounts()).toEqual([account]);
  const newer = JSON.stringify({ version: 100, state: { accounts: [account], session: null } });
  window.localStorage.setItem(key, newer);
  await expect(repository.readSession()).rejects.toMatchObject({ code: 'protocol' });
  expect(window.localStorage.getItem(key)).toBe(newer);
});

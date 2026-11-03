import { createAppStore } from '@clouddrive/state-foundation';
import {
  AuthError,
  type AuthErrorCode,
  type AuthService,
  type AuthSession,
  type LoginInput,
  type RegisterInput,
} from './contract';

type AuthState = {
  status: 'idle' | 'restoring' | 'anonymous' | 'authenticated' | 'error';
  session: AuthSession | null;
  busy: boolean;
  error: AuthErrorCode | null;
  failedOperation: 'restore' | 'login' | 'register' | 'logout' | null;
  authenticatedFrom: 'restore' | 'login' | 'register' | null;
  endReason: 'expired' | 'logout' | null;
  restore: () => Promise<void>;
  login: (input: LoginInput) => Promise<boolean>;
  register: (input: RegisterInput) => Promise<boolean>;
  logout: () => Promise<boolean>;
  expire: () => void;
};

/** The sole current-user state. Backend credentials are never persisted. */
export function createAuthController(
  service: AuthService,
  onIdentityChange: (userId: string | null) => boolean | void,
) {
  let revision = 0;
  let resolvedUserId: string | null | undefined;
  return createAppStore<AuthState>((set, get) => {
    function commit(
      session: AuthSession | null,
      origin: AuthState['authenticatedFrom'] = null,
      endReason: AuthState['endReason'] = null,
    ) {
      const nextId = session?.user.id ?? null;
      const navigating = resolvedUserId !== nextId && onIdentityChange(nextId) === true;
      resolvedUserId = nextId;
      set({
        session: navigating ? null : session,
        status: navigating ? 'restoring' : session ? 'authenticated' : 'anonymous',
        busy: navigating,
        error: null,
        failedOperation: null,
        authenticatedFrom: origin,
        endReason,
      });
    }
    async function authenticate(
      operation: 'login' | 'register',
      input: LoginInput | RegisterInput,
    ) {
      if (get().busy) return false;
      const current = ++revision;
      set({ busy: true, error: null, failedOperation: null });
      try {
        const session =
          operation === 'register' && 'name' in input
            ? await service.register(input)
            : await service.login(input);
        if (current !== revision) return false;
        commit(session, operation);
        return true;
      } catch (error) {
        if (current === revision)
          set({
            status: 'anonymous',
            session: null,
            busy: false,
            error: error instanceof AuthError ? error.code : 'unavailable',
            failedOperation: operation,
          });
        return false;
      }
    }
    return {
      status: 'idle',
      session: null,
      busy: false,
      error: null,
      failedOperation: null,
      authenticatedFrom: null,
      endReason: null,
      restore: async () => {
        if (get().busy) return;
        const hadSession = Boolean(get().session);
        const current = ++revision;
        set({
          busy: true,
          error: null,
          failedOperation: null,
          ...(get().session ? {} : { status: 'restoring' }),
        });
        try {
          const session = await service.restore();
          if (current === revision)
            commit(session, session ? 'restore' : null, !session && hadSession ? 'expired' : null);
        } catch (error) {
          if (current !== revision) return;
          set({
            session: null,
            status: 'error',
            busy: false,
            error: error instanceof AuthError ? error.code : 'unavailable',
            failedOperation: 'restore',
          });
          try {
            onIdentityChange(null);
            resolvedUserId = null;
          } catch {
            set({ error: 'unavailable' });
          }
        }
      },
      login: (input) => authenticate('login', input),
      register: (input) => authenticate('register', input),
      logout: async () => {
        const current = ++revision;
        // Hide protected content before waiting for a potentially slow server logout.
        set({ session: null, status: 'restoring', busy: true, error: null, failedOperation: null });
        try {
          onIdentityChange(null);
          resolvedUserId = null;
          await service.logout();
          if (current !== revision) return false;
          commit(null, null, 'logout');
          return true;
        } catch (error) {
          if (current === revision)
            set({
              status: 'error',
              busy: false,
              error: error instanceof AuthError ? error.code : 'unavailable',
              failedOperation: 'logout',
            });
          return false;
        }
      },
      expire: () => {
        ++revision;
        set({
          session: null,
          status: 'anonymous',
          busy: false,
          endReason: 'expired',
          authenticatedFrom: null,
        });
        try {
          commit(null, null, 'expired');
        } catch {
          set({ status: 'error', error: 'unavailable', failedOperation: 'restore' });
        }
      },
    };
  });
}

export type AuthController = ReturnType<typeof createAuthController>;

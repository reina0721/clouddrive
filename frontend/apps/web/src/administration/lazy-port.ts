import type { AdministrationPort } from '@clouddrive/surface/administration';
import { IdentityError } from '@clouddrive/surface/identity/runtime';

/** Keep validation and business adapters out of the initial shell bundle. */
export function createLazyAdministrationPort(
  base: string,
  currentUserId: () => string | null,
): AdministrationPort {
  let loaded: Promise<AdministrationPort> | undefined;
  const load = async () => {
    const owner = currentUserId();
    if (!owner) throw new IdentityError('unauthenticated');
    const port = await (loaded ??= import('./backend').then((module) =>
      module.createAdministrationPort(base, currentUserId),
    ));
    if (owner !== currentUserId()) throw new IdentityError('unauthenticated');
    return port;
  };
  return {
    preferences: async () => (await load()).preferences(),
    savePreferences: async (value) => (await load()).savePreferences(value),
    profile: async () => (await load()).profile(),
    saveProfile: async (value) => (await load()).saveProfile(value),
    organization: async (kind) => (await load()).organization(kind),
    saveOrganization: async (...args) => (await load()).saveOrganization(...args),
    assignment: async (id) => (await load()).assignment(id),
    assign: async (value) => (await load()).assign(value),
    menus: async () => (await load()).menus(),
    saveMenu: async (value) => (await load()).saveMenu(value),
    dictionaries: async () => (await load()).dictionaries(),
    saveDictionary: async (...args) => (await load()).saveDictionary(...args),
    removeDictionary: async (value) => (await load()).removeDictionary(value),
    saveDictionaryItem: async (...args) => (await load()).saveDictionaryItem(...args),
    removeDictionaryItem: async (value) => (await load()).removeDictionaryItem(value),
    todos: async () => (await load()).todos(),
    createTodo: async (title) => (await load()).createTodo(title),
    completeTodo: async (id) => (await load()).completeTodo(id),
    dashboard: async () => (await load()).dashboard(),
    mfaStatus: async () => (await load()).mfaStatus(),
    beginMfa: async () => (await load()).beginMfa(),
    confirmMfa: async (code) => (await load()).confirmMfa(code),
    disableMfa: async (code) => (await load()).disableMfa(code),
    tokens: async () => (await load()).tokens(),
    createToken: async (...args) => (await load()).createToken(...args),
    updateToken: async (value) => (await load()).updateToken(value),
    tokenAction: async (...args) => (await load()).tokenAction(...args),
    permissions: async () => (await load()).permissions(),
    archiveAccount: async (...args) => (await load()).archiveAccount(...args),
    resetPassword: async (...args) => (await load()).resetPassword(...args),
    beginArchive: async () => (await load()).beginArchive(),
    confirmArchive: async (id) => (await load()).confirmArchive(id),
    runtime: {
      probe: async (...args) => (await load()).runtime.probe(...args),
      build: async (...args) => (await load()).runtime.build(...args),
      metadata: async (...args) => (await load()).runtime.metadata(...args),
      diagnostics: async (...args) => (await load()).runtime.diagnostics(...args),
      metrics: async (...args) => (await load()).runtime.metrics(...args),
      metricsText: async (...args) => (await load()).runtime.metricsText(...args),
    },
    securityAudit: async (...args) => (await load()).securityAudit(...args),
    endSession: () => {
      void load().then((port) => port.endSession());
    },
    rolePermissions: async (id) => (await load()).rolePermissions(id),
    replaceRolePermissions: async (value) => (await load()).replaceRolePermissions(value),
  };
}

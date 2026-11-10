import {
  FilesError,
  fileEntrySchema,
  shortcutListingSchema,
  pinListingSchema,
  navigationRevisionSchema,
  type NavigationPort,
} from '@clouddrive/surface/files';
import type { createJsonClient } from '../api/json-client';
import type { SiteAddresses } from '@clouddrive/surface/administration';
import { fileDestinationHrefs } from './destinations';
import {
  parseFileShareAddress,
  readShareSaveIntent,
  withoutShareSaveIntent,
} from './share-address';

/** createFileNavigationPort 复用既有会话传输，Host拥有链接、片段与原生新标签动作。 */
export function createFileNavigationPort(
  call: ReturnType<typeof createJsonClient>,
  rawBase: string,
  assertCurrent: () => void,
  siteAddresses?: SiteAddresses,
): NavigationPort {
  const shortcutHref = (id: string) => {
    assertCurrent();
    return rawBase + '/shortcuts/' + encodeURIComponent(id) + '/open';
  };
  return {
    shortcuts: async (query, signal) =>
      shortcutListingSchema.parse(
        await call('/shortcuts?' + new URLSearchParams(query).toString(), signal ? { signal } : {}),
      ),
    saveShortcut: async (input) => {
      assertCurrent();
      const token = parseFileShareAddress(input.address, location.origin, siteAddresses);
      return fileEntrySchema.parse(
        await call('/shortcuts', {
          method: 'POST',
          body: { token, parentId: input.parentId, name: input.name },
        }),
      );
    },
    purgeShortcut: async (entry) => {
      if (entry.kind !== 'shortcut' || entry.trashedAt === null) throw new FilesError('invalid');
      await call('/shortcuts/' + encodeURIComponent(entry.id), {
        method: 'DELETE',
        body: { revision: entry.contentRevision },
      });
    },
    shortcutHref,
    pinHref: (pin) => {
      assertCurrent();
      if (!pin.available) throw new FilesError('missing');
      return pin.targetKind === 'shortcut'
        ? shortcutHref(pin.targetId)
        : pin.targetKind === 'shared'
          ? fileDestinationHrefs.shared
          : fileDestinationHrefs.files +
            (pin.targetId ? '?' + new URLSearchParams({ parent: pin.targetId }).toString() : '');
    },
    openShortcut: (id) => {
      const anchor = document.createElement('a');
      anchor.href = shortcutHref(id);
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    },
    readSaveIntent: () => {
      assertCurrent();
      return readShareSaveIntent(location.hash, location.origin);
    },
    clearSaveIntent: () => {
      assertCurrent();
      history.replaceState(
        history.state,
        '',
        location.pathname + location.search + withoutShareSaveIntent(location.hash),
      );
    },
    pins: async (signal) => pinListingSchema.parse(await call('/pins', signal ? { signal } : {})),
    addPin: async (snapshot, target) => {
      navigationRevisionSchema.parse(
        await call('/pins', { method: 'POST', body: { ...target, revision: snapshot.revision } }),
      );
    },
    removePin: async (snapshot, id) => {
      navigationRevisionSchema.parse(
        await call('/pins/' + encodeURIComponent(id), {
          method: 'DELETE',
          body: { revision: snapshot.revision },
        }),
      );
    },
    reorderPins: async (snapshot, ids) => {
      navigationRevisionSchema.parse(
        await call('/pins/order', { method: 'PUT', body: { revision: snapshot.revision, ids } }),
      );
    },
  };
}

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generatedRouteCatalog as catalog } from '../surfaces/generated/catalog/catalog.ts';

const definitions = catalog.aliases.map((group) => ({
  ID: 'group:' + group.groupId,
  ModuleID: 'console',
  RouteID: '',
  TitleMessageID: group.labelKey,
  IconID: '',
  DefaultParentID: '',
  DefaultOrder: group.order,
  Manageable: true,
}));
for (const { pluginId, contribution } of catalog.contributions) {
  for (const parent of contribution.parents) {
    definitions.push({
      ID: parent.navigationId,
      ModuleID: pluginId,
      RouteID: parent.routeId ?? '',
      TitleMessageID: parent.labelKey,
      IconID: parent.iconId ?? '',
      DefaultParentID: 'group:' + parent.groupId,
      DefaultOrder: parent.order ?? 0,
      Manageable: true,
    });
    for (const child of parent.children ?? [])
      definitions.push({
        ID: child.navigationId,
        ModuleID: pluginId,
        RouteID: child.routeId,
        TitleMessageID: child.labelKey,
        IconID: child.iconId ?? '',
        DefaultParentID: parent.navigationId,
        DefaultOrder: child.order ?? 0,
        Manageable: true,
      });
  }
}
const file = new URL(
  '../../internal/module/navigation/binding/consolecatalog/catalog.json',
  import.meta.url,
);
const output = JSON.stringify(definitions, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if ((await readFile(file, 'utf8')) !== output)
    throw new Error('Backend navigation catalog is stale; run pnpm codegen:backend');
} else {
  await mkdir(new URL('.', file), { recursive: true });
  await writeFile(file, output);
}
console.log('Backend navigation catalog: ' + fileURLToPath(file));

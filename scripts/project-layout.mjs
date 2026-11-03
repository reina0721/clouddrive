import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const layout=JSON.parse(fs.readFileSync(path.join(root,'.scaffold/layout.json'),'utf8'));
const fields={webuiRoot:layout.roots.webui,toolsRoot:layout.roots.tools,releaseRoot:layout.roots.release,openapiOutput:layout.generatedArtifacts.openapi,operationInventoryOutput:layout.generatedArtifacts.operationInventory};
const value=fields[process.argv[process.argv.indexOf('--field')+1]];
if(!value)throw new Error('Unknown layout field');
console.log(path.join(root,value));

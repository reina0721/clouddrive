import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { isPublicationTemporaryFile, publishArtifacts } from './publish-artifacts.mjs';

test('a no-op reconcile preserves the files observed by module watchers', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'clouddrive-codegen-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const artifacts = [
    { path: join(root, 'composition', 'composition.ts'), content: 'export {};\n' },
  ];
  await publishArtifacts(artifacts);
  const before = await stat(artifacts[0].path);
  await publishArtifacts(artifacts);
  const after = await stat(artifacts[0].path);
  assert.equal(after.ino, before.ino);
  assert.equal(after.mtimeNs ?? after.mtimeMs, before.mtimeNs ?? before.mtimeMs);
});

test('independent generators publish complete modules while a reader is active', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'clouddrive-codegen-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'composition.ts');
  const texts = ['a', 'b', 'c'].map(
    (letter) => `export const value = '${letter.repeat(256 * 1024)}';\n`,
  );
  await publishArtifacts([{ path, content: texts[0] }]);
  const script = `
    import { publishArtifacts } from ${JSON.stringify(new URL('./publish-artifacts.mjs', import.meta.url).href)};
    const [path, letter] = process.argv.slice(1);
    for (let i = 0; i < 13; i++) {
      await publishArtifacts([{path, content: "export const value = '" + (i % 2 ? 'a' : letter).repeat(256 * 1024) + "';\\n"}]);
    }
  `;
  let finished = false;
  const writers = Promise.all(
    ['b', 'c'].map(
      (letter) =>
        new Promise((resolve, reject) => {
          const child = spawn(
            process.execPath,
            ['--input-type=module', '-e', script, path, letter],
            { stdio: ['ignore', 'ignore', 'pipe'] },
          );
          let stderr = '';
          child.stderr.on('data', (chunk) => {
            stderr += chunk;
          });
          child.on('error', reject);
          child.on('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(stderr || `exit ${code}`)),
          );
        }),
    ),
  ).finally(() => {
    finished = true;
  });
  let reads = 0;
  try {
    while (!finished) {
      assert.ok(
        texts.includes(await readFile(path, 'utf8')),
        'reader observed a partial or unexpected module',
      );
      reads++;
    }
  } finally {
    await writers;
  }
  assert.ok(reads > 0);
  assert.ok(texts.slice(1).includes(await readFile(path, 'utf8')));
});

test('reconciliation excludes another publisher’s temporary module, not stale modules', () => {
  assert.equal(isPublicationTemporaryFile('/generated/composition.ts.12345678'), true);
  assert.equal(isPublicationTemporaryFile('/app/page.tsx.4294967295'), true);
  assert.equal(isPublicationTemporaryFile('/generated/obsolete.ts'), false);
  assert.equal(isPublicationTemporaryFile('/generated/obsolete.txt'), false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyGoFormat } from './verify-go-format.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'clouddrive-format-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', root]);
  return root;
}

test('检查已跟踪与新增源码，忽略运行产物并允许已删除源码', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, '.gitignore'), '.data/\n');
  mkdirSync(join(root, '.data'));
  writeFileSync(join(root, '.data/diagnostic.go'), 'package broken\nfunc');
  const source = join(root, 'space name.go');
  writeFileSync(source, 'package sample\n');
  execFileSync('git', ['add', '.gitignore', 'space name.go'], { cwd: root });
  verifyGoFormat(root);
  writeFileSync(source, 'package sample\nfunc f( ){ }\n');
  assert.throws(() => verifyGoFormat(root), /space name.go/);
  unlinkSync(source);
  verifyGoFormat(root);
  writeFileSync(join(root, 'new.go'), 'package sample\nfunc f( ){ }\n');
  assert.throws(() => verifyGoFormat(root), /new.go/);
});

test('Git 失败不能当成空源码通过', (t) => {
  const root = fixture(t);
  rmSync(join(root, '.git'), { recursive: true, force: true });
  assert.throws(() => verifyGoFormat(root));
});

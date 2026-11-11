import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { artifactIssues, verifyArtifacts } from "./verify-artifacts.mjs";

const fixture = "frontend/file-tests/fixtures/archives/browser.zip";
function directory(t) {
  const root = mkdtempSync(join(tmpdir(), "clouddrive-artifacts-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("仅允许经过内容校验的项目压缩夹具，保留其它产物禁入", (t) => {
  const root = directory(t);
  mkdirSync(join(root, "frontend/file-tests/fixtures/archives"), {
    recursive: true,
  });
  copyFileSync(new URL("../" + fixture, import.meta.url), join(root, fixture));
  assert.deepEqual(artifactIssues(root, [fixture, "source.go"]), []);
  const rejected = [
    "build.exe",
    "user.db",
    "private.PEM",
    "test-results/capture.zip",
    "newline\narchive.zip",
  ];
  assert.equal(artifactIssues(root, rejected).length, rejected.length);
});

test("同名夹具被替换、缺失或长度相同时损坏均失败", (t) => {
  const root = directory(t);
  assert.equal(artifactIssues(root, [fixture]).length, 1);
  mkdirSync(join(root, "frontend/file-tests/fixtures/archives"), {
    recursive: true,
  });
  for (const content of [Buffer.from("changed"), Buffer.alloc(439)]) {
    writeFileSync(join(root, fixture), content);
    assert.equal(artifactIssues(root, [fixture]).length, 1);
  }
});

test("Git 读取失败不能被解释成零产物通过", (t) => {
  assert.throws(() => verifyArtifacts(directory(t)));
});

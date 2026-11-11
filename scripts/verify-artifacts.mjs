#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const forbiddenExtension =
  /\.(exe|dll|so|dylib|test|out|db|sqlite|key|pem|p12|pfx|zip|tar|gz)$/i;
// 项目自有、非敏感的协议夹具；内容及来源见相邻 README，不放行其它归档。
const archiveFixtures = new Map([
  [
    "frontend/file-tests/fixtures/archives/browser.zip",
    {
      bytes: 439,
      sha256:
        "7495f2e0223d9d50d983ff9f2bcce3b5dd2c8dd3d38c73c82dde2309c09dc052",
    },
  ],
]);

export function artifactIssues(root, paths) {
  const issues = [];
  for (const path of new Set(paths)) {
    if (!forbiddenExtension.test(path)) continue;
    const expected = archiveFixtures.get(path);
    if (!expected) {
      issues.push(`禁止的构建、数据、密钥或归档产物：${JSON.stringify(path)}`);
      continue;
    }
    try {
      const file = join(root, path);
      if (statSync(file).size !== expected.bytes) throw new Error("大小不符");
      const hash = createHash("sha256")
        .update(readFileSync(file))
        .digest("hex");
      if (hash !== expected.sha256) throw new Error("摘要不符");
    } catch (error) {
      issues.push(
        `测试归档夹具校验失败：${JSON.stringify(path)}（${error.code ?? error.message}）`,
      );
    }
  }
  return issues;
}

export function verifyArtifacts(root) {
  // NUL 保留特殊路径；Git 读取失败直接失败，不能成为空清单成功。
  const paths = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
    .split("\0")
    .filter(Boolean);
  const issues = artifactIssues(root, paths);
  if (issues.length) throw new Error(issues.join("\n"));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    verifyArtifacts(repositoryRoot);
    console.log(
      "Artifact check passed: source files and verified test fixtures only.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readdirSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  parseArgs,
  collectChanges,
  classifyChanges,
  selectGoPackages,
  parseGoPackages,
  buildPlan,
  runCommand,
  main,
} from "./verify-changed.mjs";

const workspaces = [
  { directory: "frontend/apps/web", name: "@clouddrive/web" },
  { directory: "frontend/packages/core", name: "@clouddrive/core" },
];
function repository(t) {
  const root = mkdtempSync(join(tmpdir(), "clouddrive-validation-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, stdio: "pipe", encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "fixture@example.test");
  git("config", "user.name", "验证夹具");
  return {
    root,
    git,
    write: (name, value = name) => {
      const path = join(root, name);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, value);
    },
  };
}

test("收集暂存、未暂存、未跟踪、改名两端、删除和特殊路径", (t) => {
  const { root, git, write } = repository(t);
  for (const name of ["tracked.go", "renamed.go", "deleted.go"]) write(name);
  git("add", ".");
  git("commit", "-qm", "fixture");
  git("mv", "renamed.go", "中文 文件.go");
  git("rm", "deleted.go");
  write("tracked.go", "modified");
  write("staged.go");
  git("add", "staged.go");
  write("untracked\nfile.go");
  assert.deepEqual(
    collectChanges(root).paths,
    [
      "deleted.go",
      "renamed.go",
      "staged.go",
      "tracked.go",
      "untracked\nfile.go",
      "中文 文件.go",
    ].sort(),
  );
  assert.throws(() => collectChanges(root, "missing-base"), /Git 读取失败/);
});

test("base 覆盖提交与工作树，无首次提交明确缺少基线", (t) => {
  const { root, git, write } = repository(t);
  write("first.md");
  assert.equal(collectChanges(root).baseline, null);
  git("add", ".");
  git("commit", "-qm", "first");
  const base = git("rev-parse", "HEAD").trim();
  write("second.md");
  git("add", ".");
  git("commit", "-qm", "second");
  write("third.md");
  assert.deepEqual(collectChanges(root, base).paths, ["second.md", "third.md"]);
});

test("纯文档计划不包含业务测试和前端构建", () => {
  const selected = classifyChanges(["docs/guide.md", "README.md"], workspaces);
  const plan = buildPlan(selected, parseArgs([]), "/repository");
  assert.equal(plan.length, 1);
  assert.equal(plan[0].name, "文档拓扑");
});

test("局部页面使用原生反向依赖过滤，不执行构建或完整浏览器", () => {
  const selected = classifyChanges(
    ["frontend/apps/web/src/page.tsx"],
    workspaces,
  );
  const plan = buildPlan(selected, parseArgs([]), "/repository");
  assert.equal(selected.fullFrontend, false);
  assert.ok(plan.some((step) => step.args.includes("...@clouddrive/web")));
  assert.ok(
    plan.every(
      (step) =>
        !step.args.includes("build") && !step.args.includes("test:browser"),
    ),
  );
});

test("共享组件、契约、依赖、未知路径和无基线扩大且给出原因", () => {
  for (const path of [
    "frontend/packages/core/src/index.ts",
    "frontend/pnpm-lock.yaml",
  ])
    assert.equal(classifyChanges([path], workspaces).fullFrontend, true);
  for (const path of ["internal/transport/http/route.go", "unexpected.bin"]) {
    const result = classifyChanges([path], workspaces);
    assert.ok(
      result.fullFrontend && result.fullBackend && result.reasons.length,
    );
  }
  assert.equal(
    classifyChanges([], workspaces, { noBaseline: true }).fullBackend,
    true,
  );
  assert.equal(classifyChanges(["docs/tool.js"], workspaces).fullBackend, true);
  assert.equal(
    classifyChanges(["pkg/database/client.go"], workspaces).race,
    true,
  );
});

test("Go 反向闭包包括 TestImports 和 XTestImports", () => {
  const packages = [
    { Dir: "/repo/pkg/a", ImportPath: "a" },
    { Dir: "/repo/pkg/b", ImportPath: "b", TestImports: ["a"] },
    { Dir: "/repo/pkg/c", ImportPath: "c", XTestImports: ["b"] },
    { Dir: "/repo/pkg/d", ImportPath: "d" },
  ];
  assert.deepEqual(selectGoPackages(packages, ["pkg/a/a.go"], "/repo"), [
    "a",
    "b",
    "c",
  ]);
  assert.equal(
    selectGoPackages(packages, ["pkg/deleted/file.go"], "/repo"),
    null,
  );
  const stream = '{"Dir":"/a/{quoted}","ImportPath":"a"}\n{"ImportPath":"b"}';
  assert.equal(parseGoPackages(stream).length, 2);
  assert.throws(() => parseGoPackages(""), /为空/);
});

test("空选择不启动命令，错误参数不隐式忽略", () => {
  assert.deepEqual(
    buildPlan(classifyChanges([], workspaces), parseArgs([]), "/repo"),
    [],
  );
  assert.throws(() => parseArgs(["--unknown"]), /未知/);
  assert.throws(() => parseArgs(["--base"]), /缺少/);
  assert.throws(
    () => buildPlan({ backend: true, goPaths: [] }, parseArgs([]), "/repo"),
    /不能为空/,
  );
  assert.throws(
    () => buildPlan({ frontend: true, packages: [] }, parseArgs([]), "/repo"),
    /不能为空/,
  );
});

test("浏览器配置与 spec 必须存在，实际命令包含配置与非空用例", (t) => {
  const { root, write } = repository(t);
  const options = parseArgs([
    "--browser",
    "file-tests/sample.spec.ts",
    "--browser-config",
    "playwright.files.config.ts",
  ]);
  assert.throws(() => buildPlan({}, options, root), /浏览器配置/);
  write("frontend/playwright.files.config.ts");
  write("frontend/file-tests/sample.spec.ts");
  const plan = buildPlan({}, options, root);
  assert.equal(plan.length, 2);
  assert.ok(plan[0].args.includes("--list"));
  assert.ok(plan[1].args.includes("playwright.files.config.ts"));
});

test("dry-run 仅输出计划，不写报告或准备环境", async (t) => {
  const { root, git, write } = repository(t);
  write("README.md");
  git("add", ".");
  git("commit", "-qm", "first");
  write("README.md", "changed");
  await main(["--dry-run", "--prepare"], root);
  assert.equal(existsSync(join(root, ".data")), false);
  assert.equal(existsSync(join(root, "frontend/node_modules")), false);
});

test("子命令失败、缺工具和取消保留失败结果并等待退出", async () => {
  await assert.rejects(
    runCommand(process.execPath, ["-e", "process.exit(7)"]),
    /退出码 7/,
  );
  await assert.rejects(
    runCommand("missing-clouddrive-executable", []),
    /无法启动/,
  );
  const controller = new AbortController();
  const running = runCommand(
    process.execPath,
    ["-e", "setInterval(()=>{},1000)"],
    { signal: controller.signal },
  );
  setTimeout(() => controller.abort(), 100);
  await assert.rejects(running, /取消/);
});

// 构建约束改动需要跨平台扩大，不能只依赖当前平台的包图。
test("构建约束改变时扩大后端", (t) => {
  const { root, git, write } = repository(t);
  write("tagged.go", "package example\n");
  git("add", ".");
  git("commit", "-qm", "first");
  write("tagged.go", "//go:build linux\n\npackage example\n");
  const changes = collectChanges(root);
  assert.equal(changes.buildConstraintsChanged, true);
  assert.equal(
    classifyChanges(changes.paths, [], { buildConstraintsChanged: true })
      .fullBackend,
    true,
  );
});

test("完整入口保留全量脚本，准备显式传递", () => {
  const plan = buildPlan(
    { fullBackend: true, fullFrontend: true },
    parseArgs(["--prepare"]),
    "/repo",
  );
  assert.equal(plan.length, 2);
  assert.ok(plan[0].args.some((arg) => /[Vv]erify-[Qq]uality/.test(arg)));
  assert.ok(
    plan[1].args.includes(
      process.platform === "win32" ? "-Prepare" : "--prepare",
    ),
  );
});

test("准备失败仍生成失败报告，不记录原始输出", async (t) => {
  const { root, git, write } = repository(t);
  write("README.md");
  git("add", ".");
  git("commit", "-qm", "first");
  write("README.md", "changed");
  await assert.rejects(
    main(["--scope", "docs", "--go-executable", "missing-clouddrive-go"], root),
  );
  const directory = join(root, ".data/validation");
  const report = JSON.parse(
    readFileSync(join(directory, readdirSync(directory)[0]), "utf8"),
  );
  assert.equal(report.status, "failed");
  assert.equal(report.inputFingerprint.length, 64);
  assert.equal(report.steps[0].status, "failed");
  assert.equal(report.steps[0].output, undefined);
});

test("超时与主动取消具有不同错误类型", async () => {
  await assert.rejects(
    runCommand(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      timeoutMs: 30,
    }),
    (error) => error.name === "TimeoutError",
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runCommand(process.execPath, ["-e", ""], { signal: controller.signal }),
    (error) => error.name === "AbortError",
  );
});

test("平台特有测试也扩大后端，不依赖本机可见的包图", () => {
  for (const path of [
    "pkg/io/handle_windows_test.go",
    "pkg/io/handle_windows_386_test.go",
    "pkg/io/handle_linux_test.go",
    "pkg/io/handle_arm64_test.go",
  ]) {
    const selected = classifyChanges([path], workspaces);
    assert.equal(selected.fullBackend, true, path);
  }
  assert.equal(
    classifyChanges(["pkg/io/handle_test.go"], workspaces).fullBackend,
    false,
  );
});

test("取消验证会等待并终止后代进程，而非只终止直接命令", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "clouddrive-command-tree-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const pidFile = join(directory, "child.pid");
  const controller = new AbortController();
  const script = `
    const {spawn} = require('node:child_process');
    const {writeFileSync} = require('node:fs');
    process.on('SIGTERM', () => {});
    const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {stdio:'inherit'});
    writeFileSync(process.argv[1], String(child.pid));
    setInterval(()=>{},1000);
  `;
  const result = runCommand(process.execPath, ["-e", script, pidFile], {
    signal: controller.signal,
  }).then(
    () => null,
    (error) => error,
  );
  let childPid;
  try {
    const deadline = Date.now() + 10_000;
    while (!existsSync(pidFile) && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(existsSync(pidFile), "直接进程应报告已创建的后代");
    childPid = Number(readFileSync(pidFile, "utf8"));
    controller.abort();
    assert.equal((await result).name, "AbortError");
    assert.throws(() => process.kill(childPid, 0), /ESRCH|no such process/i);
  } finally {
    controller.abort();
    await result;
    if (childPid) {
      try {
        process.kill(childPid, "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
  }
});

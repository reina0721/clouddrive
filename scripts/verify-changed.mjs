#!/usr/bin/env node
// 日常验证只编排项目策略；依赖图、测试缓存和测试执行交给原生工具。
import { execFileSync, spawn } from "node:child_process";
import {
  createReadStream,
  lstatSync,
  readlinkSync,
  existsSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_STEP_TIMEOUT_MS = 15 * 60 * 1000;
const CANCEL_GRACE_MS = 2000;
const MAX_CAPTURE_BYTES = 32 * 1024 * 1024;
const GO_RACE_ROOTS = [
  "internal/kernel/",
  "internal/composition/",
  "internal/bootstrap/",
  "pkg/execution/",
  "pkg/schedule/",
  "pkg/messaging/",
  "pkg/database/",
];
const GENERATED_INPUTS = [
  "api/",
  "internal/transport/http/",
  "internal/tools/contract-gen/",
];
const FRONTEND_CONFIGS = [
  "frontend/tooling/",
  "frontend/package.json",
  "frontend/pnpm-lock.yaml",
  "frontend/pnpm-workspace.yaml",
  "frontend/eslint",
  "frontend/.prettier",
  "frontend/tsconfig",
  "frontend/playwright",
];

export function parseArgs(args) {
  const options = {
    browsers: [],
    goExecutable: "go",
    browserConfig: "playwright.config.ts",
  };
  const values = new Map([
    ["--scope", "scope"],
    ["--base", "base"],
    ["--go-executable", "goExecutable"],
    ["--browser-config", "browserConfig"],
  ]);
  const switches = new Map([
    ["--dry-run", "dryRun"],
    ["--classify", "classify"],
    ["--full", "full"],
    ["--race", "race"],
    ["--prepare", "prepare"],
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (switches.has(arg)) options[switches.get(arg)] = true;
    else if (values.has(arg) || arg === "--browser") {
      const value = args[++index];
      if (!value || value.startsWith("--"))
        throw new Error(`缺少参数值：${arg}`);
      if (arg === "--browser") options.browsers.push(value);
      else options[values.get(arg)] = value;
    } else throw new Error("未知参数；请使用文档列出的选项");
  }
  if (options.scope && !["backend", "frontend", "docs"].includes(options.scope))
    throw new Error("scope 必须为 backend、frontend 或 docs");
  if (
    options.classify &&
    (options.prepare || options.full || options.browsers.length)
  )
    throw new Error("--classify 不能执行准备或验证");
  return options;
}

function git(root, args, allowMissing = false) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (allowMissing && error.status === 1) return "";
    throw new Error(`Git 读取失败：${args[0]}`, { cause: error });
  }
}

export function collectChanges(root, base) {
  git(root, ["rev-parse", "--is-inside-work-tree"]);
  const revision = git(
    root,
    ["rev-parse", "--verify", "--quiet", "HEAD"],
    true,
  ).trim();
  let baseline = revision;
  if (base) {
    git(root, ["rev-parse", "--verify", `${base}^{commit}`]);
    if (!revision) throw new Error("指定 base 时必须已有 HEAD");
    baseline = git(root, ["merge-base", base, "HEAD"]).trim();
  }
  const paths = new Set();
  // 禁用改名合并，源路径和目标路径都会出现；路径以 NUL 分隔。
  for (const args of [
    ...(baseline
      ? [["diff", "--name-only", "--no-renames", "-z", baseline, "--"]]
      : []),
    ["diff", "--cached", "--name-only", "--no-renames", "-z", "--"],
    ["ls-files", "--others", "--exclude-standard", "-z"],
  ]) {
    for (const path of git(root, args).split("\0")) if (path) paths.add(path);
  }
  return {
    revision: revision || null,
    baseline: baseline || null,
    buildConstraintsChanged: Boolean(
      baseline &&
      paths.size &&
      [...paths].some((path) => path.endsWith(".go")) &&
      /^[+-]\/\/go:build[ \t]/m.test(
        git(root, ["diff", "--unified=0", baseline, "--", "*.go"]),
      ),
    ),
    paths: [...paths].sort(),
  };
}

export function readWorkspaces(root) {
  const frontend = join(root, "frontend");
  const directories = ["surfaces"];
  for (const parent of ["apps", "packages"]) {
    const directory = join(frontend, parent);
    if (existsSync(directory)) {
      for (const entry of readdirSync(directory, { withFileTypes: true }))
        if (entry.isDirectory()) directories.push(`${parent}/${entry.name}`);
    }
  }
  return directories.flatMap((directory) => {
    const path = join(frontend, directory, "package.json");
    return existsSync(path)
      ? [
          {
            directory: `frontend/${directory}`,
            ...JSON.parse(readFileSync(path, "utf8")),
          },
        ]
      : [];
  });
}

export function classifyChanges(paths, workspaces, options = {}) {
  const selection = {
    changed: paths.length > 0,
    backend: false,
    frontend: false,
    docs: false,
    database: false,
    api: false,
    fullBackend: false,
    fullFrontend: false,
    race: Boolean(options.race),
    reasons: [],
    paths,
    goPaths: [],
    frontendPaths: [],
    packages: [],
  };
  const expand = (reason, target = "both") => {
    if (
      !selection.reasons.some(
        (item) => item.split("：")[0] === reason.split("：")[0],
      )
    )
      selection.reasons.push(reason);
    if (target !== "frontend") {
      selection.backend = true;
      selection.fullBackend = true;
      selection.database = true;
    }
    if (target !== "backend") {
      selection.frontend = true;
      selection.fullFrontend = true;
    }
  };
  if (options.full || options.noBaseline)
    expand(options.full ? "显式完整验证" : "无可比较的提交基线");
  if (options.buildConstraintsChanged) expand("Go 构建约束变化", "backend");
  for (const path of paths) {
    if (/\.md$/i.test(path) || path === "docs/documentation.yaml") {
      selection.docs = true;
      continue;
    }
    if (
      GENERATED_INPUTS.some((prefix) => path.startsWith(prefix)) ||
      path.includes("/binding/http/") ||
      path.includes("/binding/consolecatalog/")
    ) {
      selection.api = true;
      expand(`契约输入：${path}`);
      continue;
    }
    if (path === "go.mod" || path === "go.sum") {
      expand(`Go 依赖：${path}`, "backend");
      continue;
    }
    if (path.startsWith("frontend/")) {
      selection.frontend = true;
      selection.frontendPaths.push(path);
      const workspace = workspaces.find((item) =>
        path.startsWith(`${item.directory}/`),
      );
      if (
        FRONTEND_CONFIGS.some((prefix) => path.startsWith(prefix)) ||
        path.endsWith("/package.json") ||
        /(?:vitest|tsconfig|next\.config|postcss\.config)/.test(path)
      ) {
        expand(`前端配置/依赖：${path}`, "frontend");
      } else if (!workspace) expand(`无法归属的前端文件：${path}`, "frontend");
      else {
        selection.packages.push(workspace.name);
        if (workspace.directory.startsWith("frontend/packages/"))
          expand(`共享前端能力：${workspace.name}`, "frontend");
      }
      continue;
    }
    if (
      path.endsWith(".go") ||
      ["internal/", "pkg/", "cmd/"].some((prefix) => path.startsWith(prefix))
    ) {
      selection.backend = true;
      selection.goPaths.push(path);
      if (GO_RACE_ROOTS.some((prefix) => path.startsWith(prefix)))
        selection.race = true;
      if (/migration|pkg\/database\//.test(path)) selection.database = true;
      if (
        /_(?:windows|linux|darwin|amd64|arm64)(?:_[a-z0-9]+)?(?:_test)?\.go$/.test(
          path,
        )
      )
        expand(`跨平台源码：${path}`, "backend");
      continue;
    }
    if (path === "SOURCES.json" || path.startsWith("docs/provenance/")) {
      selection.docs = true;
      continue;
    }
    expand(`工具、配置或未知归属：${path}`);
  }
  selection.packages = [...new Set(selection.packages)].sort();
  if (selection.backend || selection.frontend) selection.docs = true;
  return selection;
}

export function parseGoPackages(stream) {
  const packages = [];
  let depth = 0,
    quoted = false,
    escaped = false,
    start = 0;
  for (let index = 0; index < stream.length; index += 1) {
    const char = stream[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "{") {
      if (depth++ === 0) start = index;
    } else if (char === "}" && --depth === 0)
      packages.push(JSON.parse(stream.slice(start, index + 1)));
  }
  if (depth !== 0 || quoted) throw new Error("Go 包图不完整");
  if (!packages.length) throw new Error("Go 包图为空");
  return packages;
}

export function selectGoPackages(packages, paths, root) {
  const selected = new Set();
  for (const path of paths) {
    const directory = dirname(resolve(root, path));
    const owner = packages
      .filter(
        (item) =>
          directory === item.Dir || directory.startsWith(`${item.Dir}${sep}`),
      )
      .sort((a, b) => b.Dir.length - a.Dir.length)[0];
    // 已删除的包和不属于当前包图的资源不能当成零项成功。
    if (!owner || (path.endsWith(".go") && directory !== owner.Dir))
      return null;
    selected.add(owner.ImportPath);
  }
  let previousSize;
  do {
    previousSize = selected.size;
    for (const item of packages) {
      if (
        [
          ...(item.Imports ?? []),
          ...(item.TestImports ?? []),
          ...(item.XTestImports ?? []),
        ].some((dependency) => selected.has(dependency))
      )
        selected.add(item.ImportPath);
    }
  } while (selected.size !== previousSize);
  return [...selected].sort();
}

export function runCommand(
  command,
  args,
  {
    cwd,
    capture = false,
    signal,
    timeoutMs = DEFAULT_STEP_TIMEOUT_MS,
    env = process.env,
  } = {},
) {
  return new Promise((resolveRun, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("验证已取消", "AbortError"));
      return;
    }
    // POSIX 进程组只用于拥有并回收整棵命令树；始终等待，不 unref 或保留后台进程。
    const windowsCommand =
      process.platform === "win32" && /\.cmd$/i.test(command);
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    const script = windowsCommand
      ? `& ${quote(command)} @(${args.map(quote).join(",")}); exit $LASTEXITCODE`
      : "";
    const executable = windowsCommand ? "powershell.exe" : command;
    const parameters = windowsCommand
      ? [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          Buffer.from(script, "utf16le").toString("base64"),
        ]
      : args;
    const child = spawn(executable, parameters, {
      cwd,
      env,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "",
      stopped = false,
      timer,
      killTimer,
      cleanupError,
      interruption,
      outputBytes = 0;
    const kill = (force) => {
      if (!child.pid) return;
      try {
        if (process.platform === "win32") {
          if (force)
            execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
              stdio: "ignore",
            });
          else child.kill("SIGTERM");
        } else process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
      } catch (error) {
        if (error.code !== "ESRCH")
          cleanupError = new Error("清理验证进程失败", { cause: error });
      }
    };
    const stop = (reason) => {
      if (stopped) return;
      interruption = reason;
      stopped = true;
      kill(process.platform === "win32");
      killTimer ??= setTimeout(() => kill(true), CANCEL_GRACE_MS);
    };
    const cancel = () => stop(new DOMException("验证已取消", "AbortError"));
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    };
    child.stdout.on("data", (chunk) => {
      if (capture) {
        outputBytes += chunk.length;
        if (outputBytes > MAX_CAPTURE_BYTES)
          stop(new RangeError("验证读取输出超过容量上限"));
        else output += chunk;
      } else process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
    signal?.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(
      () => stop(new DOMException("验证步骤超过时限", "TimeoutError")),
      timeoutMs,
    );
    child.once("error", (error) => {
      cleanup();
      clearTimeout(killTimer);
      reject(new Error(`无法启动 ${command}`, { cause: error }));
    });
    child.once("close", (code, exitSignal) => {
      cleanup();
      if (stopped) {
        // 直接进程退出也不代表其后代已经退出，先清理剩余进程组。
        if (process.platform !== "win32") kill(true);
        clearTimeout(killTimer);
        const cancellation = interruption;
        reject(
          cleanupError
            ? new AggregateError(
                [cancellation, cleanupError],
                "验证取消且进程清理失败",
              )
            : cancellation,
        );
        return;
      }
      clearTimeout(killTimer);
      if (code !== 0)
        reject(new Error(`命令失败：${command}，退出码 ${code ?? exitSignal}`));
      else resolveRun(output);
    });
  });
}

function fullStep(root, kind, options) {
  const windows = process.platform === "win32";
  const script =
    kind === "backend"
      ? windows
        ? "Verify-Quality.ps1"
        : "verify-quality.sh"
      : windows
        ? "Verify-WebUI.ps1"
        : "verify-webui.sh";
  const args = windows
    ? ["-NoProfile", "-File", join(root, "scripts", script)]
    : [join(root, "scripts", script)];
  if (kind === "backend")
    args.push(
      windows ? "-GoExecutable" : "--go-executable",
      options.goExecutable,
    );
  if (kind === "frontend" && options.prepare)
    args.push(windows ? "-Prepare" : "--prepare");
  return {
    name: `完整${kind === "backend" ? "后端" : "前端"}`,
    command: windows ? "pwsh" : "bash",
    args,
    cwd: root,
  };
}

export function buildPlan(selection, options, root, goPackages = []) {
  const steps = [];
  const pnpm = (name, args) =>
    steps.push({
      name,
      command: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      args,
      cwd: join(root, "frontend"),
    });
  const go = (name, args) =>
    steps.push({ name, command: options.goExecutable, args, cwd: root });
  if (selection.docs)
    go("文档拓扑", [
      "run",
      "./internal/tools/docs-guard",
      "--config",
      "docs/documentation.yaml",
    ]);
  if (selection.fullBackend) steps.push(fullStep(root, "backend", options));
  else if (selection.backend) {
    if (!goPackages.length) throw new Error("后端选择不能为空");
    const changedGo = selection.goPaths.filter(
      (path) => path.endsWith(".go") && existsSync(join(root, path)),
    );
    if (changedGo.length)
      steps.push({
        name: "Go 格式",
        command: join(
          dirname(options.goExecutable),
          process.platform === "win32" ? "gofmt.exe" : "gofmt",
        ),
        args: ["-l", ...changedGo],
        cwd: root,
        formatCheck: true,
      });
    go("Go 测试", [
      "test",
      ...(selection.race ? ["-race"] : []),
      ...goPackages,
    ]);
    go("Go 静态检查", ["vet", ...goPackages]);
  }
  if (selection.fullFrontend) steps.push(fullStep(root, "frontend", options));
  else if (selection.frontend) {
    if (!selection.packages.length) throw new Error("前端工作区选择不能为空");
    if (options.prepare) {
      pnpm("准备前端依赖", ["install", "--frozen-lockfile"]);
      if (options.browsers.length)
        pnpm("准备 Chromium", ["exec", "playwright", "install", "chromium"]);
    }
    for (const script of [
      "foundation:check",
      "architecture:check",
      "dependency:check",
      "codegen:plugins:check",
      "codegen:backend:check",
      "codegen:contracts:check",
      "codegen:design:check",
    ])
      pnpm(script, [script]);
    const existing = selection.frontendPaths
      .filter((path) => existsSync(join(root, path)))
      .map((path) => path.slice("frontend/".length));
    const source = existing.filter((path) => /\.(?:ts|tsx|js|mjs)$/.test(path));
    if (source.length)
      pnpm("改动文件 lint", [
        "exec",
        "eslint",
        "--max-warnings",
        "0",
        ...source,
      ]);
    if (existing.length)
      pnpm("改动文件格式", ["exec", "prettier", "--check", ...existing]);
    const filters = selection.packages.flatMap((name) => [
      "--filter",
      `...${name}`,
    ]);
    for (const script of ["typecheck", "test"])
      pnpm(`工作区 ${script}`, [
        "--fail-if-no-match",
        ...filters,
        "-r",
        "--if-present",
        script,
      ]);
  }
  if (options.browsers.length) {
    if (options.prepare && !selection.frontend) {
      pnpm("准备前端依赖", ["install", "--frozen-lockfile"]);
      pnpm("准备 Chromium", ["exec", "playwright", "install", "chromium"]);
    }
    const config = resolve(root, "frontend", options.browserConfig);
    if (!existsSync(config) || !config.startsWith(join(root, "frontend") + sep))
      throw new Error("浏览器配置必须是 frontend 中存在的文件");
    for (const spec of options.browsers) {
      if (
        isAbsolute(spec) ||
        !existsSync(resolve(root, "frontend", spec)) ||
        !resolve(root, "frontend", spec).startsWith(
          join(root, "frontend") + sep,
        )
      )
        throw new Error(`浏览器用例不存在或越界：${spec}`);
    }
    pnpm("浏览器用例选择", [
      "exec",
      "playwright",
      "test",
      "--config",
      options.browserConfig,
      "--list",
      ...options.browsers,
    ]);
    pnpm("定向浏览器验证", [
      "exec",
      "playwright",
      "test",
      "--config",
      options.browserConfig,
      ...options.browsers,
    ]);
  }
  return steps;
}

function failureStatus(error) {
  if (error.name === "AbortError") return "cancelled";
  if (error.name === "TimeoutError") return "timed-out";
  return "failed";
}

export async function main(
  args = process.argv.slice(2),
  root = repositoryRoot,
) {
  const options = parseArgs(args);
  const changes = collectChanges(root, options.base);
  const selection = classifyChanges(changes.paths, readWorkspaces(root), {
    ...options,
    noBaseline: !changes.baseline,
    buildConstraintsChanged: changes.buildConstraintsChanged,
  });
  if (options.scope) {
    if (options.scope !== "backend") {
      selection.backend = false;
      selection.fullBackend = false;
    }
    if (options.scope !== "frontend") {
      selection.frontend = false;
      selection.fullFrontend = false;
    }
    if (options.scope !== "docs") selection.docs = false;
  }
  if (options.classify) {
    console.log(JSON.stringify(selection));
    return;
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  const results = [];
  const tools = { node: process.version };
  let inputFingerprint;
  let primaryError;
  const started = performance.now();
  try {
    const fingerprint = createHash("sha256");
    for (const path of changes.paths) {
      fingerprint.update(path).update("\0");
      const absolute = join(root, path);
      const stat = lstatSync(absolute, { throwIfNoEntry: false });
      if (!stat) fingerprint.update("<deleted>");
      else {
        if (stat.isSymbolicLink()) fingerprint.update(readlinkSync(absolute));
        else if (stat.isFile()) {
          for await (const chunk of createReadStream(absolute, {
            signal: controller.signal,
          }))
            fingerprint.update(chunk);
        } else fingerprint.update("<directory>");
      }
    }
    inputFingerprint = fingerprint.digest("hex");
    let goPackages = [];
    if (selection.backend && !selection.fullBackend) {
      const graph = parseGoPackages(
        await runCommand(
          options.goExecutable,
          [
            "list",
            "-mod=readonly",
            "-json=ImportPath,Dir,Imports,TestImports,XTestImports",
            "./...",
          ],
          { cwd: root, capture: true, signal: controller.signal },
        ),
      );
      goPackages = selectGoPackages(graph, selection.goPaths, root);
      if (!goPackages) {
        selection.fullBackend = true;
        selection.database = true;
        selection.reasons.push("删除包或资源无法归属，扩大后端验证");
      }
    }
    const plan = buildPlan(selection, options, root, goPackages);
    console.log(
      JSON.stringify(
        {
          revision: changes.revision,
          reasons: selection.reasons,
          goPackages,
          packages: selection.packages,
          steps: plan,
        },
        null,
        2,
      ),
    );
    if (options.dryRun) return;
    if (!plan.length) {
      console.log("没有需要验证的改动。");
      return;
    }
    const hasFrontend = plan.some(
      (step) => step.cwd === join(root, "frontend") || step.name === "完整前端",
    );
    if (
      hasFrontend &&
      !options.prepare &&
      !existsSync(join(root, "frontend/node_modules"))
    )
      throw new Error("缺少前端依赖；请明确运行 --prepare 后再验证");
    if (selection.backend || selection.docs)
      tools.go = (
        await runCommand(options.goExecutable, ["version"], {
          cwd: root,
          capture: true,
          signal: controller.signal,
        })
      ).trim();
    if (hasFrontend)
      tools.pnpm = (
        await runCommand(
          process.platform === "win32" ? "pnpm.cmd" : "pnpm",
          ["--version"],
          { cwd: root, capture: true, signal: controller.signal },
        )
      ).trim();
    for (const step of plan) {
      const stepStarted = performance.now();
      console.log(`\n验证：${step.name}`);
      try {
        const output = await runCommand(step.command, step.args, {
          cwd: step.cwd,
          capture: step.formatCheck,
          signal: controller.signal,
        });
        if (step.formatCheck && output.trim())
          throw new Error(`Go 文件格式不符合 gofmt：${output.trim()}`);
        results.push({
          name: step.name,
          command: step.command,
          args: step.args,
          status: "passed",
          durationMs: Math.round(performance.now() - stepStarted),
        });
      } catch (error) {
        results.push({
          name: step.name,
          command: step.command,
          args: step.args,
          status: failureStatus(error),
          durationMs: Math.round(performance.now() - stepStarted),
        });
        throw error;
      }
    }
  } catch (error) {
    primaryError = error;
    if (!results.length && !options.dryRun)
      results.push({
        name: "验证准备与选择",
        status: failureStatus(error),
        durationMs: Math.round(performance.now() - started),
      });
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
    if (!options.dryRun && results.length) {
      const report = {
        revision: changes.revision,
        inputFingerprint,
        changedPathCount: changes.paths.length,
        tools,
        reasons: selection.reasons,
        status: primaryError ? failureStatus(primaryError) : "passed",
        durationMs: Math.round(performance.now() - started),
        steps: results,
      };
      try {
        const directory = join(root, ".data/validation");
        mkdirSync(directory, { recursive: true });
        const path = join(directory, `${Date.now()}.json`);
        writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
        console.log(`验证报告：${relative(root, path)}`);
      } catch (error) {
        primaryError = primaryError
          ? new AggregateError([primaryError, error], "验证与报告写入均失败")
          : error;
      }
    }
  }
  if (primaryError) throw primaryError;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = error.name === "AbortError" ? 130 : 1;
  });
}

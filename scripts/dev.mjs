#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  access,
  chmod,
  mkdir,
  open,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// SQLite、配置与日志的默认权限统一由启动 owner 收紧。
process.umask(0o077);

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({
  options: {
    preview: { type: "boolean", default: false },
    prepare: { type: "boolean", default: false },
    webpack: { type: "boolean", default: false },
    "web-port": { type: "string" },
    "api-port": { type: "string" },
    "management-port": { type: "string" },
    help: { type: "boolean", default: false },
  },
});
if (values.help) {
  console.log(
    "node scripts/dev.mjs [--preview] [--prepare] [--webpack] [--web-port N] [--api-port N] [--management-port N]\n前台运行，Ctrl+C 关闭拥有的进程树。--preview 使用独立数据库并初始化测试账号。",
  );
  process.exit(0);
}
if (Number(process.versions.node.split(".")[0]) < 24)
  throw new Error("启动工具需要 Node 24 或更高版本。");
const port = (value, fallback) => {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < 1024 || number > 65535)
    throw new Error("端口须为 1024–65535 的整数。");
  return number;
};
const webPort = port(values["web-port"], values.preview ? 4180 : 4173);
const apiPort = port(values["api-port"], values.preview ? 8120 : 8080);
const managementPort = port(
  values["management-port"],
  values.preview ? 9120 : 9090,
);
if (new Set([webPort, apiPort, managementPort]).size !== 3)
  throw new Error("三个服务必须使用不同端口。");
const data = join(repo, ".data", values.preview ? "preview" : "dev");
const binary = join(
  repo,
  ".tools",
  `clouddrive-${values.preview ? "preview" : "dev"}${process.platform === "win32" ? ".exe" : ""}`,
);
const workdir = values.preview ? data : repo;
const base = `http://127.0.0.1:${webPort}`;
const backend = `http://127.0.0.1:${apiPort}`;
const children = new Set();
const logFiles = [];
const controller = new AbortController();
let stopping = false;
let failure;
let environmentLock;

function run(command, args, options = {}) {
  controller.signal.throwIfAborted();
  const child = spawn(command, args, {
    cwd: options.cwd ?? repo,
    env: { ...process.env, ...options.env },
    stdio: options.stdio ?? "inherit",
    detached: process.platform !== "win32",
    shell: false,
  });
  const result = new Promise((resolveResult, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveResult();
      else reject(new Error(`${command} 退出 (${signal ?? code})`));
    });
  });
  const record = { child, result };
  children.add(record);
  // 立即安装 rejection handler，后台服务退出不能变成未处理的 Promise。
  result.then(
    () => {
      if (!options.service) children.delete(record);
      if (options.service && !stopping)
        fail(new Error("开发服务提前退出，请检查日志。"));
    },
    (error) => {
      if (!options.service) children.delete(record);
      if (!stopping) fail(error);
    },
  );
  // 保留进程组记录到统一清理结束：根进程退出后仍可能有派生进程。
  return result;
}
function pnpm(args, options = {}) {
  if (process.platform === "win32") {
    // 参数均由本工具生成；不用 shell 解释目录或配置值。
    return run(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", "npx.cmd --yes pnpm@10.22.0 " + args.join(" ")],
      options,
    );
  }
  return run("pnpm", args, options);
}
function fail(error) {
  failure ??= error;
  controller.abort(error);
}
process.on("SIGINT", () => controller.abort());
process.on("SIGTERM", () => controller.abort());
async function stop() {
  stopping = true;
  for (const { child } of children) {
    if (!child.pid) continue;
    if (process.platform === "win32") {
      // Windows 没有 POSIX process group，taskkill 只操作本工具拥有的树。
      if (child.exitCode === null && child.signalCode === null) {
        await new Promise((done) => {
          const killer = spawn(
            "taskkill.exe",
            ["/PID", String(child.pid), "/T", "/F"],
            { stdio: "ignore" },
          );
          killer.once("error", done);
          killer.once("exit", done);
        });
      }
    } else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
  }
  const forced = setTimeout(() => {
    if (process.platform === "win32") return;
    for (const { child } of children) {
      if (!child.pid) continue;
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") console.error(error.message);
      }
    }
  }, 8_000);
  try {
    await Promise.allSettled([...children].map(({ result }) => result));
  } finally {
    clearTimeout(forced);
    await Promise.all(logFiles.map((file) => file.close()));
    if (environmentLock) {
      await environmentLock.close();
      await unlink(join(data, "run.lock"));
    }
  }
}
async function freePort(number) {
  await new Promise((done, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(new Error(`端口 ${number} 已被占用；不会终止其进程。`)),
    );
    server.listen(number, "127.0.0.1", () => server.close(done));
  });
}
async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function privateWrite(path, content) {
  await writeFile(path, content, { mode: 0o600 });
  if (process.platform !== "win32") await chmod(path, 0o600);
}
async function ready(url) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    controller.signal.throwIfAborted();
    try {
      const response = await fetch(url, {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(5_000),
        ]),
      });
      await response.arrayBuffer();
      if (response.ok) return;
    } catch {
      controller.signal.throwIfAborted();
    }
    await new Promise((done) => {
      const timer = setTimeout(done, 250);
      controller.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          done();
        },
        { once: true, signal: AbortSignal.timeout(300) },
      );
    });
  }
  throw new Error(`启动超时：${url}。日志：${data}`);
}
async function launch(name, command, args, options = {}) {
  const file = await open(join(data, `${name}.log`), "a", 0o600);
  logFiles.push(file);
  return {
    started: run(command, args, {
      ...options,
      service: true,
      stdio: ["ignore", file.fd, file.fd],
    }),
  };
}

try {
  for (const number of [webPort, apiPort, managementPort])
    await freePort(number);
  await mkdir(data, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    await chmod(join(repo, ".data"), 0o700);
    await chmod(data, 0o700);
  }
  try {
    environmentLock = await open(join(data, "run.lock"), "wx", 0o600);
    await environmentLock.writeFile(String(process.pid) + "\n");
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        `环境已被占用：${data}/run.lock。异常退出后，请先确认原进程已停止再删除锁文件。`,
      );
    throw error;
  }
  await mkdir(join(repo, ".tools"), { recursive: true });
  await run("go", ["version"]);
  await run("go", ["build", "-o", binary, "./cmd/app"]);
  if (values.prepare)
    await pnpm(["install", "--frozen-lockfile"], {
      cwd: join(repo, "frontend"),
    });
  if (!(await exists(join(repo, "frontend", "node_modules"))))
    throw new Error("前端依赖缺失，请使用 --prepare。");
  const tokenPath = join(data, "setup-token");
  if (!(await exists(tokenPath)))
    await privateWrite(tokenPath, randomBytes(32).toString("base64url") + "\n");
  const setupToken =
    (!values.preview && process.env.APP_IAM__LOCAL__SETUPTOKEN) ||
    (await readFile(tokenPath, "utf8")).trim();
  const environment = {
    // 预览不能继承调用者的数据库、Storage 或认证配置而连接到真实数据。
    ...(values.preview
      ? Object.fromEntries(
          Object.keys(process.env)
            .filter((name) => name.startsWith("APP_"))
            .map((name) => [name, undefined]),
        )
      : {}),
    APP_IAM__LOCAL__SETUPTOKEN: setupToken,
    APP_HTTP__ADDR: `127.0.0.1:${apiPort}`,
    APP_MANAGEMENT__ADDR: `127.0.0.1:${managementPort}`,
    APP_HTTP__CORS__ALLOWEDORIGINS: JSON.stringify([base]),
  };
  let accessPath;
  if (values.preview) {
    // 与正常开发、已有 Windows 预览互不共享数据库和凭据。
    const configPath = join(data, "config.yaml");
    accessPath = join(data, "access.json");
    let preview;
    if (await exists(accessPath)) {
      preview = JSON.parse(await readFile(accessPath, "utf8"));
      if (
        preview.environment !== "clouddrive-node-preview-v1" ||
        typeof preview.password !== "string"
      )
        throw new Error("预览目录不是本工具创建的环境，已保留其内容。");
    } else {
      if (await exists(configPath))
        throw new Error("预览目录已有配置，已保留其内容。");
      preview = {
        environment: "clouddrive-node-preview-v1",
        username: "preview@clouddrive.test",
        password: randomBytes(24).toString("base64url"),
      };
    }
    Object.assign(preview, {
      url: base + "/home",
      apiUrl: backend,
      managementUrl: `http://127.0.0.1:${managementPort}`,
      setupToken,
      dataDirectory: data,
    });
    await privateWrite(
      configPath,
      `logger:\n  environment: development\n  level: info\ndatabase:\n  driver: sqlite\n  dsn: app.db\nauth:\n  mode: session\nhttp:\n  cors:\n    allowedOrigins: [${base}]\nstorage:\n  driver: local\n  local:\n    basePath: storage\nfiles:\n  transfers:\n    stagingPath: transfers\n`,
    );
    await privateWrite(accessPath, JSON.stringify(preview, null, 2) + "\n");
  } else if (!(await exists(join(repo, "config.yaml")))) {
    await run(binary, ["config", "init"]);
  }
  await run(binary, ["db", "migrate", "up"], {
    cwd: workdir,
    env: environment,
  });
  await launch("backend", binary, [], { cwd: workdir, env: environment });
  await ready(`http://127.0.0.1:${managementPort}/readyz`);
  await ready(backend + "/api/console/v1/auth/registration-policy");
  await pnpm(["codegen:plugins"], { cwd: join(repo, "frontend") });
  // 前端使用同一 Node 生命周期，生成器与 HMR 仍由既有 frontend dev 入口拥有。
  await launch(
    "frontend",
    process.execPath,
    [join(repo, "frontend/tooling/plugin-codegen/dev.mjs")],
    {
      cwd: join(repo, "frontend"),
      env: {
        NEXT_PUBLIC_AUTH_MODE: "backend",
        NEXT_PUBLIC_AUTH_API_BASE_URL: "/api/console/v1",
        WEB_DEPLOYMENT_MODE: "server",
        WEB_HOST: "127.0.0.1",
        WEB_PORT: String(webPort),
        CLOUDDRIVE_BACKEND_URL: backend,
        NEXT_DIST_DIR: values.preview ? ".next/preview" : ".next",
        ...(values.webpack
          ? { CLOUDDRIVE_DEV_BUNDLER: "webpack", WATCHPACK_POLLING: "true" }
          : {}),
      },
    },
  );
  await ready(base + "/login");
  await ready(base + "/api/console/v1/auth/registration-policy");
  if (accessPath)
    await run(process.execPath, [
      join(repo, "scripts/initialize-file-preview.mjs"),
      accessPath,
    ]);
  console.log(
    `clouddrive: ${base}/home\n日志：${data}\n${accessPath ? `测试账号：${accessPath}` : `首次设置：${base}/setup；令牌：${tokenPath}`}\nCtrl+C 关闭服务，数据保留。`,
  );
  if (!controller.signal.aborted)
    await new Promise((done) =>
      controller.signal.addEventListener("abort", done, { once: true }),
    );
} catch (error) {
  if (!controller.signal.aborted) failure = error;
} finally {
  await stop();
}
if (failure) {
  console.error(
    `启动失败：${failure.message}\n查看 ${data} 中的日志；Linux 出现 inotify/EMFILE 时检查用户监听配额。`,
  );
  process.exitCode = 1;
}

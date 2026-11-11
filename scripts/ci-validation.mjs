// CI 与本地共用分类器；GitHub 只消费稳定布尔输出，不复制依赖选择规则。
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  collectChanges,
  readWorkspaces,
  classifyChanges,
  main,
} from "./verify-changed.mjs";

const root = resolve(import.meta.dirname, "..");
const base = process.env.VALIDATION_BASE ?? "";
const full =
  process.env.VALIDATION_FULL === "true" || !base || /^0+$/.test(base);
try {
  if (process.argv[2] === "classify") {
    const changes = collectChanges(root, full ? undefined : base);
    const selected = classifyChanges(changes.paths, readWorkspaces(root), {
      full,
      buildConstraintsChanged: changes.buildConstraintsChanged,
    });
    const outputs = {
      backend: selected.backend,
      frontend: selected.frontend,
      docs: selected.docs,
      database: selected.database,
      api: full || selected.api,
      fuzz:
        full ||
        changes.paths.some((path) =>
          path.startsWith("internal/kernel/config/"),
        ),
      full,
      base: full ? "" : base,
    };
    if (!process.env.GITHUB_OUTPUT)
      throw new Error("CI 分类需要 GITHUB_OUTPUT");
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      Object.entries(outputs)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(""),
    );
    console.log(JSON.stringify({ ...outputs, reasons: selected.reasons }));
  } else {
    const scope = process.argv[2];
    if (!["backend", "frontend", "docs"].includes(scope))
      throw new Error("CI 验证范围无效");
    await main(
      [
        "--scope",
        scope,
        ...(full ? ["--full"] : ["--base", base]),
        ...(scope === "frontend" ? ["--prepare"] : []),
      ],
      root,
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

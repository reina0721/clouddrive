import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

function cli(args) {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("./dev.mjs", import.meta.url)), ...args],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (value) => {
    output += value;
  });
  child.stderr.on("data", (value) => {
    output += value;
  });
  return once(child, "exit").then(([code]) => ({ code, output }));
}

test("启动前拒绝无效或重复端口", async () => {
  for (const args of [
    ["--web-port", "0"],
    ["--web-port", "65536"],
    ["--web-port", "4173", "--api-port", "4173"],
    ["--unknown"],
  ])
    assert.notEqual((await cli(args)).code, 0);
});

test("端口冲突不终止占用者，也不启动 Go 或迁移", async () => {
  let requests = 0;
  const server = createServer((socket) => {
    requests += 1;
    socket.end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const port = server.address().port;
    const result = await cli(["--web-port", String(port)]);
    assert.equal(result.code, 1);
    assert.match(result.output, /已被占用/);
    assert.doesNotMatch(result.output, /go version|migration operation/);
    assert.equal(server.listening, true);
    assert.equal(requests, 0);
  } finally {
    await new Promise((done) => server.close(done));
  }
});

test("帮助不启动任何服务", async () => {
  const result = await cli(["--help"]);
  assert.equal(result.code, 0);
  assert.match(result.output, /--preview/);
  assert.match(result.output, /Ctrl\+C/);
});

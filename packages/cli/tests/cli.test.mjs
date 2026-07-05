import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cli = "packages/cli/dist/index.js";

test("--version prints the package version and exits successfully", async () => {
  const result = await run(["--version"]);
  const expectedVersion = JSON.parse(await readFile("packages/cli/package.json", "utf8")).version;
  assert.equal(result.code, 0);
  assert.equal(result.stdout.trim(), expectedVersion);
  assert.equal(result.stderr, "");
});

test("--help prints usage and exits successfully", async () => {
  const result = await run(["--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Usage:/);
});

test("command help does not require workspace detection", async () => {
  const result = await run(["build", "--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /atlas build/);
});

test("unknown commands explain the error and exit unsuccessfully", async () => {
  const result = await run(["buidl"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Unknown or incomplete command "buidl"/);
});

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { stdio: "pipe" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

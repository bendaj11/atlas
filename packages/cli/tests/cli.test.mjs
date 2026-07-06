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

test("--help prints a concise command catalog", async () => {
  const result = await run(["--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Commands:\n\s+generate, g\s+Generate a host/);
  assert.doesNotMatch(result.stdout, /--registry-base-url/);
});

test("command help describes arguments, options, environment, and examples", async () => {
  const result = await run(["build", "--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Usage:\n\s+atlas build <project> \[options\]/);
  assert.match(result.stdout, /Arguments:/);
  assert.match(result.stdout, /--registry-base-url <url>/);
  assert.match(result.stdout, /Environment:/);
  assert.match(result.stdout, /Examples:/);
});

test("help command resolves command aliases", async () => {
  const result = await run(["help", "g", "host"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /atlas generate host <name> \[options\]/);
  assert.match(result.stdout, /--framework <name>/);
});

test("generation subcommand help is available without a resource name", async () => {
  const result = await run(["g", "widget", "--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /atlas generate widget <name>/);
  assert.match(result.stdout, /--app <project>/);
});

test("generation help documents automatic dependency installation control", async () => {
  const result = await run(["g", "host", "--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /--skip-install\s+Generate files without installing dependencies/);
});

test("command help ignores positional values after the command", async () => {
  const result = await run(["build", "orders", "--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /atlas build <project> \[options\]/);
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

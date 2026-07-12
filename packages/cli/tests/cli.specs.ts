import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "@jest/globals";
import { runCli } from "./cli.driver.js";

const packageJson = new URL("../package.json", import.meta.url);

test("--version prints the package version and exits successfully", async () => {
  const result = await runCli(["--version"]);
  const expectedVersion = JSON.parse(await readFile(packageJson, "utf8")).version;
  assert.equal(result.code, 0);
  assert.equal(result.stdout.trim(), expectedVersion);
  assert.equal(result.stderr, "");
});

test("--help prints a concise command catalog", async () => {
  const result = await runCli(["--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Commands:\n\s+generate, g\s+Generate a host/);
  assert.doesNotMatch(result.stdout, /--registry-base-url/);
});

test("command help describes arguments, options, environment, and examples", async () => {
  const result = await runCli(["build", "--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Usage:\n\s+atlas build <project> \[options\]/);
  assert.match(result.stdout, /Arguments:/);
  assert.match(result.stdout, /--registry-base-url <url>/);
  assert.match(result.stdout, /Environment:/);
  assert.match(result.stdout, /Examples:/);
});

test("help command resolves command aliases", async () => {
  const result = await runCli(["help", "g", "host"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /atlas generate host <name-or-path> \[options\]/);
  assert.match(result.stdout, /--framework <name>/);
});

test("generation subcommand help is available without a resource name", async () => {
  const result = await runCli(["g", "widget", "--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /atlas generate widget <name>/);
  assert.match(result.stdout, /--app <project>/);
});

test("generation help documents automatic dependency installation control", async () => {
  const result = await runCli(["g", "host", "--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /--skip-install\s+Generate files without installing dependencies/);
});

test("command help ignores positional values after the command", async () => {
  const result = await runCli(["build", "orders", "--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /atlas build <project> \[options\]/);
});

test("unknown commands explain the error and exit unsuccessfully", async () => {
  const result = await runCli(["buidl"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Unknown or incomplete command "buidl"/);
  assert.match(result.stderr, /Suggested action:/);
});

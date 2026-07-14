import { readFile } from "node:fs/promises";
import { expect, test } from "@jest/globals";
import { runCli } from "./cli.driver.js";

const packageJson = new URL("../package.json", import.meta.url);

test("--version prints the package version and exits successfully", async () => {
  const result = await runCli(["--version"]);
  const expectedVersion = JSON.parse(await readFile(packageJson, "utf8")).version;
  expect(result.code).toBe(0);
  expect(result.stdout.trim()).toBe(expectedVersion);
  expect(result.stderr).toBe("");
});

test("--help prints a concise command catalog", async () => {
  const result = await runCli(["--help"]);
  expect(result.code).toBe(0);
  expect(result.stdout).toMatch(/Commands:\n\s+generate, g\s+Generate a host/);
  expect(result.stdout).not.toMatch(/--registry-base-url/);
});

test("command help describes arguments, options, environment, and examples", async () => {
  const result = await runCli(["build", "--help"]);
  expect(result.code).toBe(0);
  expect(result.stdout).toMatch(/Usage:\n\s+atlas build <project> \[options\]/);
  expect(result.stdout).toMatch(/Arguments:/);
  expect(result.stdout).toMatch(/--registry-base-url <url>/);
  expect(result.stdout).toMatch(/Environment:/);
  expect(result.stdout).toMatch(/Examples:/);
});

test("help command resolves command aliases", async () => {
  const result = await runCli(["help", "g", "host"]);
  expect(result.code).toBe(0);
  expect(result.stdout).toMatch(/atlas generate host <name-or-path> \[options\]/);
  expect(result.stdout).toMatch(/--framework <name>/);
});

test("generation subcommand help is available without a resource name", async () => {
  const result = await runCli(["g", "widget", "--help"]);
  expect(result.code).toBe(0);
  expect(result.stdout).toMatch(/atlas generate widget <name>/);
  expect(result.stdout).toMatch(/--app <project>/);
});

test("generation help documents automatic dependency installation control", async () => {
  const result = await runCli(["g", "host", "--help"]);
  expect(result.code).toBe(0);
  expect(result.stdout).toMatch(/--skip-install\s+Generate files without installing dependencies/);
  expect(result.stdout).toMatch(/--directory <path>\s+Host-client target; server uses sibling <path>-server/);
});

test("app generation help accepts only an explicit host id", async () => {
  const result = await runCli(["g", "app", "--help"]);
  expect(result.code).toBe(0);
  expect(result.stdout).toMatch(/--host-id <host-id>\s+Stable host id used for the generated route/);
  expect(result.stdout).not.toMatch(/--host <host-id>/);
});

test("command help ignores positional values after the command", async () => {
  const result = await runCli(["build", "orders", "--help"]);
  expect(result.code).toBe(0);
  expect(result.stdout).toMatch(/atlas build <project> \[options\]/);
});

test("unknown commands explain the error and exit unsuccessfully", async () => {
  const result = await runCli(["buidl"]);
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/Unknown or incomplete command "buidl"/);
  expect(result.stderr).toMatch(/Suggested action:/);
});

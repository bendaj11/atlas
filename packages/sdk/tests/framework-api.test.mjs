import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as angular from "../dist/angular.js";
import * as react from "../dist/react.js";

test("framework subpaths share one Atlas API vocabulary", () => {
  for (const name of ["defineMicrofrontend", "defineExportedComponent", "createHostNavigation"]) {
    assert.equal(typeof angular[name], "function", `Angular must export ${name}`);
    assert.equal(typeof react[name], "function", `React must export ${name}`);
  }

  assert.equal(typeof angular.injectAtlasSdk, "function");
  assert.equal(typeof angular.provideAtlasSdk, "function");
  assert.equal(typeof react.useAtlasSdk, "function");
  assert.equal(typeof react.AtlasSdkProvider, "function");

  for (const name of [...Object.keys(angular), ...Object.keys(react)]) {
    assert.doesNotMatch(name, /Angular|React|Vue/, `${name} repeats its framework subpath`);
  }
});

test("unsupported Vue adapter is not a public SDK subpath", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.exports["./vue"], undefined);
});

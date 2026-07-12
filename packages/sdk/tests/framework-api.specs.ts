import assert from "node:assert/strict";
import { test } from "@jest/globals";
import { injectAtlasSdk, type AtlasSdk as AngularAtlasSdk } from "../dist/angular.js";
import { useAtlasSdk } from "../dist/react.js";
import type { AtlasSdk } from "../dist/host.js";
import { frameworkApis, readSdkPackage } from "./framework-api.driver.js";

const { angular, react } = frameworkApis;

interface CustomerHostSdk {
  showToast(message: string): void;
}

const readAngularSdk: () => AngularAtlasSdk<CustomerHostSdk> = injectAtlasSdk<CustomerHostSdk>;
const readReactSdk: () => AtlasSdk<CustomerHostSdk> = useAtlasSdk<CustomerHostSdk>;

test("framework subpaths share one Atlas API vocabulary", () => {
  const sharedApiNames: Array<"defineApp" | "defineExportedWidget" | "createHostNavigation"> = ["defineApp", "defineExportedWidget", "createHostNavigation"];
  for (const name of sharedApiNames) {
    assert.equal(typeof angular[name], "function", `Angular must export ${name}`);
    assert.equal(typeof react[name], "function", `React must export ${name}`);
  }

  assert.equal(typeof angular.injectAtlasSdk, "function");
  assert.equal(typeof angular.provideAtlasSdk, "function");
  assert.equal(typeof react.useAtlasSdk, "function");
  assert.equal(typeof react.AtlasSdkProvider, "function");
  assert.equal(typeof readAngularSdk, "function");
  assert.equal(typeof readReactSdk, "function");

  for (const name of [...Object.keys(angular), ...Object.keys(react)]) {
    assert.doesNotMatch(name, /Angular|React|Vue/, `${name} repeats its framework subpath`);
  }
});

test("unsupported Vue adapter is not a public SDK subpath", async () => {
  const packageJson = await readSdkPackage();
  assert.equal(packageJson.exports["./vue"], undefined);
});

import { readFile } from "node:fs/promises";
import * as angular from "../dist/angular.js";
import * as react from "../dist/react.js";

export const frameworkApis = { angular, react };

interface SdkPackage {
  readonly exports: Readonly<Record<string, unknown>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly peerDependenciesMeta: Readonly<
    Record<string, { readonly optional?: boolean }>
  >;
}

export async function readSdkPackage(): Promise<SdkPackage> {
  return JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
}

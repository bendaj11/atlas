import { readFile } from "node:fs/promises";
import * as angular from "../dist/angular.js";
import * as react from "../dist/react.js";

export const frameworkApis = { angular, react };

export async function readSdkPackage(): Promise<any> {
  return JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
}

import type { Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";

export type BrowserStorage = "localStorage" | "sessionStorage";

export interface StoredOverrideDocument {
  host?: { manifest: { version: string }; reason: string };
  apps: Array<{ manifest: { version: string }; reason: string }>;
}

export async function readOverride(host: Page, storage: BrowserStorage): Promise<StoredOverrideDocument | undefined> {
  return host.evaluate(({ key, storageName }) => {
    const value = window[storageName].getItem(key);
    return value ? JSON.parse(value) : undefined;
  }, { key: "atlas.runtime-overrides", storageName: storage });
}

export async function restrictExtensionHosts(manifestPath: string): Promise<void> {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!isRecord(manifest)) throw new Error("Extension manifest has an invalid shape.");
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

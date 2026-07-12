import type { AtlasExportedWidgetManifest } from "../../schema/dist/index.js";
import type { AtlasModalRef } from "../dist/host-overlays.js";

export interface ManualModalRef<TResult> extends AtlasModalRef<TResult> {
  resolve(value?: TResult): void;
}

export function createManualModalRef<TResult = unknown>(id: string): ManualModalRef<TResult> {
  let resolve!: (value?: TResult) => void;
  const closed = new Promise<TResult | undefined>((next) => { resolve = next; });
  return { id, closed, close: resolve, dismiss: () => resolve(undefined), resolve };
}

export function createTestElement(): HTMLElement {
  return Object.create(null);
}

export function createTestWidget(): AtlasExportedWidgetManifest {
  return {
    schemaVersion: "1",
    id: "test-widget",
    name: "Test widget",
    ownerAppId: "test-app",
    framework: "react",
    remoteEntryUrl: "https://cdn.example/test.js",
    expose: "./test-widget",
    contractVersion: "1"
  };
}

export function modalCloseFrom(props: unknown): (value?: unknown) => void {
  if (typeof props !== "object" || props === null || !("atlasModal" in props)) {
    throw new Error("Expected Atlas modal controls in widget props.");
  }
  const controls = props.atlasModal;
  if (!hasModalClose(controls)) {
    throw new Error("Expected an Atlas modal close control.");
  }
  return controls.close;
}

function hasModalClose(value: unknown): value is { close(value?: unknown): void } {
  return typeof value === "object" && value !== null && "close" in value && typeof value.close === "function";
}

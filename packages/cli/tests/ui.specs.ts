import { afterEach, expect, jest, test } from "@jest/globals";
import { ui } from "../dist/cli/ui.js";

afterEach(() => {
  jest.restoreAllMocks();
});

test("command headings use the shared Atlas title", () => {
  const output = jest.spyOn(console, "info").mockImplementation(() => undefined);

  ui.heading("Build · orders");

  expect(output).toHaveBeenCalledWith("\nAtlas · Build · orders");
});

test("success messages use the shared success marker", () => {
  const output = jest.spyOn(console, "info").mockImplementation(() => undefined);

  ui.success("Built orders.");

  expect(output).toHaveBeenCalledWith("✓ Built orders.");
});

test("warnings use standard error", () => {
  const output = jest.spyOn(console, "error").mockImplementation(() => undefined);

  ui.warning("Deployment has no Cache-Control header.");

  expect(output).toHaveBeenCalledWith("! Deployment has no Cache-Control header.");
});

test("errors place suggested action on a separate line", () => {
  const output = jest.spyOn(console, "error").mockImplementation(() => undefined);

  ui.error("Could not build orders. Suggested action: Fix atlas.config.ts, then retry.");

  expect(output.mock.calls).toStrictEqual([
    ["✖ Could not build orders."],
    ["  Suggested action: Fix atlas.config.ts, then retry."]
  ]);
});

test("errors render multiple suggested actions as readable steps", () => {
  const output = jest.spyOn(console, "error").mockImplementation(() => undefined);

  ui.error("Build failed. Suggested actions: 1) Fix atlas.config.ts. 2) Rerun atlas build.");

  expect(output.mock.calls).toStrictEqual([
    ["✖ Build failed."],
    ["  Suggested actions:"],
    ["    1. Fix atlas.config.ts."],
    ["    2. Rerun atlas build."]
  ]);
});

test("labeled results use stable plain-text formatting", () => {
  const output = jest.spyOn(console, "info").mockImplementation(() => undefined);

  ui.result("App preview", "https://host.example/orders");

  expect(output).toHaveBeenCalledWith("App preview: https://host.example/orders");
});

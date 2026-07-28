import { expect, test } from "@jest/globals";
import { createCliError } from "../dist/cli/cli-error.js";

test("unknown commands receive CLI help guidance", () => {
  const error = createCliError("buidl", new Error('Unknown or incomplete command "buidl".'));

  expect(error.summary).toBe('Unknown or incomplete command "buidl".');
  expect(error.suggestedActions).toStrictEqual([
    "Run `atlas --help` to choose a supported command, then retry with the documented arguments."
  ]);
});

test("foreign build errors receive Atlas context and build recovery", () => {
  const cause = new Error("spawn vite ENOENT");
  const error = createCliError("build", cause);

  expect(error.summary).toBe("Atlas build failed: spawn vite ENOENT");
  expect(error.suggestedActions).toStrictEqual([
    "Restore the named file or pass an existing Atlas project or path.",
    "Rerun `atlas build` after correcting the condition."
  ]);
  expect(error.cause).toBe(cause);
});

test("storage failures receive publication-specific recovery", () => {
  const error = createCliError("publish", new Error("S3 deployment lock is no longer owned."));

  expect(error.suggestedActions[0]).toMatch(/storage, registry, credentials, or deployment-lock/);
  expect(error.suggestedActions[1]).toBe("Rerun `atlas publish` after correcting the condition.");
});

test("CLI wrapping replaces browser-only guidance", () => {
  const browserFailure = new Error(
    "Atlas host failed. Suggested action: Correct atlas.runtime.json, then reload this page."
  );

  const error = createCliError("verify", browserFailure);

  expect(error.surface).toBe("cli");
  expect(error.message).not.toMatch(/reload this page/);
  expect(error.message).toMatch(/rerun `atlas verify`/);
});

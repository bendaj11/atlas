import { expect, test } from "@jest/globals";
import { CliArguments } from "../dist/arguments.js";
import { resolveInvocation } from "../dist/interaction.js";
import { createPromptDriver } from "./interaction.driver.js";

test("interactive generation asks only for missing configuration", async () => {
  const prompts = createPromptDriver(["app", "orders", "angular"]);
  const invocation = await resolveInvocation(new CliArguments(["g"]), prompts);
  expect(invocation).toStrictEqual({ command: "g", subcommand: "app", name: "orders", framework: "angular", version: undefined });
  expect(prompts.questions).toStrictEqual([
    "select:What would you like to generate?",
    "input:App name",
    "select:Framework"
  ]);
});

test("fully configured and non-interactive commands never prompt", async () => {
  const prompts = createPromptDriver([], false);
  const invocation = await resolveInvocation(new CliArguments(["g", "host", "host", "--framework=react"]), prompts);
  expect(invocation).toStrictEqual({ command: "g", subcommand: "host", name: "host", framework: "react", version: undefined });
  expect(prompts.questions).toStrictEqual([]);
});

test("interactive rollback asks for its missing artifact ID and version", async () => {
  const artifactId = "2bea9c13-4899-4f93-9211-cd8c55e9c529";
  const prompts = createPromptDriver([artifactId, "1.2.0"]);
  const invocation = await resolveInvocation(new CliArguments(["rollback"]), prompts);
  expect(invocation).toStrictEqual({
    command: "rollback",
    subcommand: artifactId,
    name: undefined,
    framework: undefined,
    version: "1.2.0"
  });
  expect(prompts.questions).toStrictEqual([
    "input:Stable host or app ID from atlas.config.ts",
    "input:Production version to restore"
  ]);
});

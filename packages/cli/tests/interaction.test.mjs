import assert from "node:assert/strict";
import test from "node:test";
import { CliArguments } from "../dist/arguments.js";
import { resolveInvocation } from "../dist/interaction.js";

test("interactive generation asks only for missing configuration", async () => {
  const prompts = fakePrompts(["app", "orders", "angular"]);
  const invocation = await resolveInvocation(new CliArguments(["g"]), prompts);
  assert.deepEqual(invocation, { command: "g", subcommand: "app", name: "orders", framework: "angular", version: undefined });
  assert.deepEqual(prompts.questions, [
    "select:What would you like to generate?",
    "input:App name",
    "select:Framework"
  ]);
});

test("fully configured and non-interactive commands never prompt", async () => {
  const prompts = fakePrompts([], false);
  const invocation = await resolveInvocation(new CliArguments(["g", "host", "host", "--framework=react"]), prompts);
  assert.deepEqual(invocation, { command: "g", subcommand: "host", name: "host", framework: "react", version: undefined });
  assert.deepEqual(prompts.questions, []);
});

test("interactive rollback asks for its missing target", async () => {
  const prompts = fakePrompts(["orders", "1.2.0"]);
  const invocation = await resolveInvocation(new CliArguments(["rollback"]), prompts);
  assert.deepEqual(invocation, {
    command: "rollback",
    subcommand: "orders",
    name: undefined,
    framework: undefined,
    version: "1.2.0"
  });
  assert.deepEqual(prompts.questions, [
    "input:Atlas project name or directory",
    "input:Production version to restore"
  ]);
});

function fakePrompts(answers, interactive = true) {
  return {
    interactive,
    questions: [],
    async input(message) { this.questions.push(`input:${message}`); return answers.shift(); },
    async select(message) { this.questions.push(`select:${message}`); return answers.shift(); },
    close() {}
  };
}

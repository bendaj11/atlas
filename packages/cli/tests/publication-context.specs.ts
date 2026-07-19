import { expect, test } from "@jest/globals";
import { CliArguments } from "../dist/arguments.js";
import { resolvePublicationContext } from "../dist/publication-context.js";

test("ordinary branches skip publication without failing", () => {
  expect(resolvePublicationContext(
    new CliArguments(["publish", "orders", "--git-branch=feature/orders", "--default-branch=main"]),
    process.cwd()
  )).toMatchObject({ publish: false, reason: expect.stringContaining("has no pull request number") });
});

test("a custom PR number publishes from any branch", () => {
  expect(resolvePublicationContext(
    new CliArguments(["publish", "orders", "--git-branch=feature/orders", "--pr-number=42"]),
    process.cwd()
  )).toStrictEqual({ publish: true });
});

test("strict publication mode turns an ordinary branch skip into an error", () => {
  expect(() => resolvePublicationContext(
    new CliArguments([
      "publish", "orders", "--git-branch=feature/orders", "--default-branch=main", "--require-publication"
    ]),
    process.cwd()
  )).toThrow(/Atlas expected a publication/);
});

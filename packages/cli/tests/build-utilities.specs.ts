import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@jest/globals";
import { generateAppFiles, generateHostFiles, generateWidgetFiles } from "../../generators/dist/index.js";
import { browserOpenCommand } from "../dist/dev.js";
import { alignDelegatedAngularFederationConfig } from "../dist/generate-nx.js";
import { assertSingleComponentDeclaration } from "./build.driver.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

test("macOS browser opener always opens the URL", () => {
  assert.deepEqual(browserOpenCommand("http://localhost:5173/orders", "darwin"), {
    command: "open",
    args: ["http://localhost:5173/orders"]
  });
});

test("non-macOS browser openers retain platform defaults", () => {
  assert.deepEqual(browserOpenCommand("http://localhost/app", "linux"), {
    command: "xdg-open",
    args: ["http://localhost/app"]
  });
});

test("Windows browser opener always opens the URL", () => {
  assert.deepEqual(browserOpenCommand("http://localhost/app", "win32"), {
    command: "cmd",
    args: ["/c", "start", "", "http://localhost/app"]
  });
});

test("generators keep component declarations split across files", () => {
  const frameworks: Array<"angular" | "react"> = ["angular", "react"];
  for (const framework of frameworks) {
    const options = { name: "orders", framework };
    const files = [
      ...generateHostFiles(options),
      ...generateAppFiles(options),
      ...generateWidgetFiles({ name: "order-status", framework })
    ];
    for (const file of files) {
      assertSingleComponentDeclaration(file.path, file.contents);
      if (framework === "react") assert.doesNotMatch(file.contents, /import\.meta\.hot/);
    }
  }
});

test("Nx Angular federation repair writes cwd-independent expose paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-nx-angular-federation-repair-"));
  const appRoot = join(root, "apps/login");
  await mkdir(appRoot, { recursive: true });
  await writeFile(join(appRoot, "federation.config.js"), `const { join } = require("node:path");
module.exports = {
  exposes: {
    "./entry": "./src/entry.ts",
    "./legacyEntry": "./apps/login/src/entry.ts",
    "./widgets/profile": \`./src/exported-widgets/\${entry.name}/index.ts\`,
    "./legacyWidget": \`./apps/login/src/exported-widgets/\${entry.name}/index.ts\`
  }
};
`);

  await alignDelegatedAngularFederationConfig(root, appRoot);

  const source = await readFile(join(appRoot, "federation.config.js"), "utf8");
  assert.equal([...source.matchAll(/join\(__dirname, "src\/entry\.ts"\)/g)].length, 2);
  assert.equal([...source.matchAll(/join\(__dirname, "src\/exported-widgets", entry\.name, "index\.ts"\)/g)].length, 2);
  assert.doesNotMatch(source, /\.\/(?:apps\/login\/)?src\/entry\.ts/);
  assert.doesNotMatch(source, /\.\/(?:apps\/login\/)?src\/exported-widgets/);
});


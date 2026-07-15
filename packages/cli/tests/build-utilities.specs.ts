import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@jest/globals";
import { generateAppFiles, generateHostFiles, generateWidgetFiles } from "../../generators/dist/index.js";
import { CliArguments } from "../dist/arguments.js";
import { browserOpenCommand, frameworkServerArguments, resolveHostDevPorts } from "../dist/dev.js";
import { alignDelegatedAngularFederationConfig } from "../dist/generate-nx.js";
import { createHostRuntimeConfig } from "../dist/runtime-config.js";
import { assertSingleComponentDeclaration } from "./build.driver.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

test("macOS browser opener always opens the URL", () => {
  expect(browserOpenCommand("http://localhost:5173/orders", "darwin")).toStrictEqual({
    command: "open",
    args: ["http://localhost:5173/orders"]
  });
});

test("non-macOS browser openers retain platform defaults", () => {
  expect(browserOpenCommand("http://localhost/app", "linux")).toStrictEqual({
    command: "xdg-open",
    args: ["http://localhost/app"]
  });
});

test("Windows browser opener always opens the URL", () => {
  expect(browserOpenCommand("http://localhost/app", "win32")).toStrictEqual({
    command: "cmd",
    args: ["/c", "start", "", "http://localhost/app"]
  });
});

test("local runtime configuration uses localhost", () => {
  const runtime = createHostRuntimeConfig({
    type: "host",
    id: "customer-host",
    name: "Customer Host",
    framework: "react"
  });

  expect(runtime.catalogUrl).toBe("http://localhost:4400/hosts/customer-host/catalog.json");
});

test("framework dev servers receive compatible localhost arguments", () => {
  expect(frameworkServerArguments("react", 4200)).toStrictEqual(["--port", "4200", "--host", "localhost"]);
  expect(frameworkServerArguments("angular", 4201)).toStrictEqual(["--port", "4201"]);
});

test("host development keeps the configured port browser-facing", () => {
  const args = new CliArguments(["dev", "customer-host"]);

  expect(resolveHostDevPorts(args, 4200)).toStrictEqual({ bootstrapPort: 4200, clientPort: 4300 });
});

test("host development supports any custom browser port", () => {
  const args = new CliArguments(["dev", "customer-host", "--port=4500"]);

  expect(resolveHostDevPorts(args, 4500)).toStrictEqual({ bootstrapPort: 4500, clientPort: 4300 });
});

test("explicit bootstrap port preserves the split-port contract", () => {
  const args = new CliArguments(["dev", "customer-host", "--port=4500", "--bootstrap-port=4502"]);

  expect(resolveHostDevPorts(args, 4500)).toStrictEqual({ bootstrapPort: 4502, clientPort: 4500 });
});

test("deployed host development keeps the configured client port", () => {
  const args = new CliArguments(["dev", "customer-host", "--port=4500", "--host-url=https://customer.example"]);

  expect(resolveHostDevPorts(args, 4500)).toStrictEqual({ bootstrapPort: 4500, clientPort: 4500 });
});

test("host development rejects one port for both local servers", () => {
  const args = new CliArguments(["dev", "customer-host", "--port=4500", "--host-client-port=4500"]);

  expect(() => resolveHostDevPorts(args, 4500)).toThrow(/must differ/);
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
      if (framework === "react") expect(file.contents).not.toMatch(/import\.meta\.hot/);
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
  expect([...source.matchAll(/join\(__dirname, "src\/entry\.ts"\)/g)].length).toBe(2);
  expect([...source.matchAll(/join\(__dirname, "src\/exported-widgets", entry\.name, "index\.ts"\)/g)].length).toBe(2);
  expect(source).not.toMatch(/\.\/(?:apps\/login\/)?src\/entry\.ts/);
  expect(source).not.toMatch(/\.\/(?:apps\/login\/)?src\/exported-widgets/);
});

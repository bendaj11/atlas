import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "@jest/globals";

const executeFile = promisify(execFile);
const factoryPath = fileURLToPath(new URL("../federation-config.cjs", import.meta.url));

test("Angular host federation exposes project-relative source", async () => {
  const projectRoot = fileURLToPath(new URL("../../../examples/hosts/demo-angular-host", import.meta.url));

  expect(await federationExposes(projectRoot, "host")).toStrictEqual({ "./host": "./src/host.ts" });
});

test("Angular app federation exposes project-relative entry and widgets", async () => {
  const projectRoot = fileURLToPath(new URL("../../../examples/apps/orders-angular", import.meta.url));

  expect(await federationExposes(projectRoot, "app")).toStrictEqual({
    "./entry": "./src/entry.ts",
    "./widgets/order-status": "./src/exported-widgets/order-status/index.ts"
  });
});

async function federationExposes(projectRoot: string, expose: "host" | "app"): Promise<Record<string, string>> {
  const script = [
    `const { createAngularFederationConfig } = require(${JSON.stringify(factoryPath)});`,
    `const config = createAngularFederationConfig(${JSON.stringify({ projectRoot, name: "test", expose })});`,
    "process.stdout.write(JSON.stringify(config.exposes));"
  ].join("\n");
  const { stdout } = await executeFile(process.execPath, ["-e", script]);
  return JSON.parse(stdout) as Record<string, string>;
}

import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "@jest/globals";

const executeFile = promisify(execFile);
const factoryPath = fileURLToPath(new URL("../federation-config.cjs", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));

test("Angular host federation exposes workspace-relative source", async () => {
  const projectRoot = fileURLToPath(new URL("../../../examples/hosts/demo-angular-host", import.meta.url));
  const exposes = await federationExposes(projectRoot, "host");

  expect(exposes).toStrictEqual({ "./host": "./examples/hosts/demo-angular-host/src/host.ts" });
  await expectSourcesToResolve(exposes);
});

test("Angular app federation exposes workspace-relative entry and widgets", async () => {
  const projectRoot = fileURLToPath(new URL("../../../examples/apps/orders-angular", import.meta.url));
  const exposes = await federationExposes(projectRoot, "app");

  expect(exposes).toStrictEqual({
    "./entry": "./examples/apps/orders-angular/src/entry.ts",
    "./widgets/order-status": "./examples/apps/orders-angular/src/exported-widgets/order-status/index.ts"
  });
  await expectSourcesToResolve(exposes);
});

async function federationExposes(projectRoot: string, expose: "host" | "app"): Promise<Record<string, string>> {
  const script = [
    `const { createAngularFederationConfig } = require(${JSON.stringify(factoryPath)});`,
    `const config = createAngularFederationConfig(${JSON.stringify({ projectRoot, name: "test", expose })});`,
    "process.stdout.write(JSON.stringify(config.exposes));"
  ].join("\n");
  const { stdout } = await executeFile(process.execPath, ["-e", script], { cwd: workspaceRoot });
  return JSON.parse(stdout) as Record<string, string>;
}

async function expectSourcesToResolve(exposes: Record<string, string>): Promise<void> {
  await Promise.all(Object.values(exposes).map((source) => access(resolve(workspaceRoot, source))));
}

import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
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
    "./widgets/order-status": "./examples/apps/orders-angular/.atlas/widgets/order-status.ts"
  });
  await expectSourcesToResolve(exposes);
  const widgetEntry = await readFile(resolve(workspaceRoot, exposes["./widgets/order-status"]), "utf8");
  expect(widgetEntry).toMatch(/createExportedWidget\(Widget\)/);
  expect(widgetEntry).toMatch(/src\/exported-widgets\/order-status\/index/);
});

test("React federation generates ignored widget lifecycle entries", async () => {
  const projectRoot = fileURLToPath(new URL("../../../examples/apps/catalog-react", import.meta.url));
  const script = [
    `const { createReactWidgetEntries } = require(${JSON.stringify(factoryPath)});`,
    `process.stdout.write(JSON.stringify(createReactWidgetEntries(${JSON.stringify({ projectRoot, reactMajor: 19 })})));`
  ].join("\n");
  const { stdout } = await executeFile(process.execPath, ["-e", script], { cwd: workspaceRoot });
  const entries = JSON.parse(stdout) as Array<{ name: string; entryPoint: string }>;
  const productCount = entries.find((entry) => entry.name === "product-count");

  expect(productCount).toBeDefined();
  const source = await readFile(resolve(projectRoot, productCount!.entryPoint), "utf8");
  expect(source).toMatch(/defineExportedWidget/);
  expect(source).toMatch(/src\/exported-widgets\/product-count\/index/);
});

test("React 17 federation uses legacy root lifecycle internally", async () => {
  const projectRoot = fileURLToPath(new URL("../../../examples/apps/catalog-react", import.meta.url));
  const script = [
    `const { createReactWidgetEntries } = require(${JSON.stringify(factoryPath)});`,
    `process.stdout.write(JSON.stringify(createReactWidgetEntries(${JSON.stringify({ projectRoot, reactMajor: 17 })})));`
  ].join("\n");
  const { stdout } = await executeFile(process.execPath, ["-e", script], { cwd: workspaceRoot });
  const [entry] = JSON.parse(stdout) as Array<{ entryPoint: string }>;
  const source = await readFile(resolve(projectRoot, entry.entryPoint), "utf8");

  expect(source).toMatch(/unmountComponentAtNode/);
  expect(source).not.toMatch(/react-dom\/client/);
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

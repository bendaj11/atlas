import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@jest/globals";
import { CliArguments } from "../dist/arguments.js";
import { AtlasGenerateService } from "../dist/generate.js";
import { detectWorkspace } from "../dist/workspace.js";
import { createPromptDriver } from "./interaction.driver.js";

const CATALOG_APP_ID = "1af74c0e-61ac-4638-8493-b459d740b75e";
const ORDERS_APP_ID = "2bea9c13-4899-4f93-9211-cd8c55e9c529";

test("interactive widget generation lists app names with stable IDs", async () => {
  const fixture = await createWidgetWorkspace();
  const prompts = createPromptDriver([ORDERS_APP_ID]);
  const generate = new AtlasGenerateService(fixture.workspace, new CliArguments(["--skip-format", "--force"]), prompts);

  await generate.widget("home-widget");

  expect(prompts.questions).toStrictEqual(["select:Which Atlas app should own this widget?"]);
  expect(prompts.choiceLabels).toStrictEqual([[
    `Orders Portal (${ORDERS_APP_ID})`,
    `Product Catalog (${CATALOG_APP_ID})`
  ]]);
  expect(await readFile(join(fixture.ordersRoot, "src/exported-widgets/home-widget/index.tsx"), "utf8")).toMatch(/HomeWidget/);
  await expect(access(join(fixture.catalogRoot, "src/exported-widgets/home-widget/index.tsx"))).rejects.toMatchObject({ code: "ENOENT" });
});

test("explicit stable app ID selects the widget owner without prompting", async () => {
  const fixture = await createWidgetWorkspace();
  const prompts = createPromptDriver([], false);
  const generate = new AtlasGenerateService(fixture.workspace, new CliArguments(["--skip-format", "--force"]), prompts);

  await generate.widget("order-summary", ORDERS_APP_ID);

  expect(prompts.questions).toStrictEqual([]);
  expect(await readFile(join(fixture.ordersRoot, "src/exported-widgets/order-summary/index.tsx"), "utf8")).toMatch(/OrderSummaryWidget/);
});

test("non-interactive widget generation reports available app names and IDs", async () => {
  const fixture = await createWidgetWorkspace();
  const generate = new AtlasGenerateService(
    fixture.workspace,
    new CliArguments(["--skip-format", "--force"]),
    createPromptDriver([], false)
  );

  await expect(generate.widget("home-widget")).rejects.toThrow(
    `--app-id <app-id> is required to generate a widget in non-interactive mode. Available apps: Orders Portal (${ORDERS_APP_ID}), Product Catalog (${CATALOG_APP_ID}).`
  );
});

async function createWidgetWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "atlas-widget-selection-"));
  const catalogRoot = await createProject(root, "catalog", {
    type: "app",
    id: CATALOG_APP_ID,
    name: "Product Catalog",
    framework: "angular"
  });
  const ordersRoot = await createProject(root, "orders", {
    type: "app",
    id: ORDERS_APP_ID,
    name: "Orders Portal",
    framework: "react"
  });
  await createProject(root, "host", {
    type: "host",
    id: "customer-host",
    name: "Customer Host",
    framework: "react"
  });
  await writeFile(join(root, "package.json"), JSON.stringify({
    name: "widget-selection-workspace",
    private: true,
    workspaces: ["catalog", "orders", "host"]
  }));
  return { root, catalogRoot, ordersRoot, workspace: await detectWorkspace(root) };
}

async function createProject(
  workspaceRoot: string,
  directory: string,
  config: { type: "app" | "host"; id: string; name: string; framework: "angular" | "react" }
): Promise<string> {
  const projectRoot = join(workspaceRoot, directory);
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: directory, version: "1.0.0" }));
  await writeFile(join(projectRoot, "atlas.config.ts"), `export default ${JSON.stringify(config)};\n`);
  return projectRoot;
}

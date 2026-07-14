import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@jest/globals";
import { loadEnvFiles } from "../dist/env.js";
import { restoreEnv, run, runDevService, testTypeScriptConfig } from "./build.driver.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

test("atlas dev without a project uses the current Atlas project directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-current-project-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "package.json"), JSON.stringify({
    name: "orders",
    version: "1.0.0",
    type: "module"
  }));
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify(testTypeScriptConfig()));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  framework: "react",',
    '  routes: [{ hostId: "customer-host", basePath: "/orders" }]',
    "};"
  ].join("\n"));

  const stdout = await run(process.execPath, [
    join(process.cwd(), "packages/cli/dist/index.js"),
    "dev",
    "--prepare-only",
    "--control-port=4521"
  ], { cwd: projectRoot, env: { ...process.env, ATLAS_HOST_URL: "http://localhost:5173" } });

  const document = JSON.parse(await readFile(join(projectRoot, ".atlas/local-overrides.json"), "utf8"));
  expect(document.hostId).toBe("customer-host");
  expect(stdout).toMatch(/Starting \./);
  expect(stdout).toMatch(/App Preview: http:\/\/localhost:5173\/orders/);
  expect(stdout).not.toMatch(/atlas-override/);
});

test("workspace env files supply Atlas dev defaults without overriding shell env", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-env-"));
  const originalHost = process.env.ATLAS_HOST_ID;
  const originalHostUrl = process.env.ATLAS_HOST_URL;
  process.env.ATLAS_HOST_ID = "shell-host";
  delete process.env.ATLAS_HOST_URL;
  await writeFile(join(root, ".env"), [
    "ATLAS_HOST_ID=file-host",
    "ATLAS_HOST_URL=http://localhost:4200",
    "# ignored"
  ].join("\n"));
  await writeFile(join(root, ".env.local"), "ATLAS_HOST_URL=http://localhost:4300\n");

  try {
    await loadEnvFiles(root);
    expect(process.env.ATLAS_HOST_ID).toBe("shell-host");
    expect(process.env.ATLAS_HOST_URL).toBe("http://localhost:4300");
  } finally {
    restoreEnv("ATLAS_HOST_ID", originalHost);
    restoreEnv("ATLAS_HOST_URL", originalHostUrl);
  }
});

test("atlas dev appends a single route to a base ATLAS_HOST_URL", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-single-host-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify(testTypeScriptConfig()));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  framework: "react",',
    '  routes: [{ hostId: "customer-host", basePath: "/orders" }]',
    "};"
  ].join("\n"));
  const originalHost = process.env.ATLAS_HOST_ID;
  const originalHostUrl = process.env.ATLAS_HOST_URL;
  delete process.env.ATLAS_HOST_ID;
  process.env.ATLAS_HOST_URL = "http://localhost:5173";

  try {
    const stdout = await runDevService(root, projectRoot, ["dev", "orders", "--control-port=4520", "--prepare-only"]);
    const document = JSON.parse(await readFile(join(projectRoot, ".atlas/local-overrides.json"), "utf8"));
    expect(document.hostId).toBe("customer-host");
    expect(stdout).toMatch(/http:\/\/localhost:5173\/orders/);
    expect(stdout).not.toMatch(/atlas-override/);
  } finally {
    restoreEnv("ATLAS_HOST_ID", originalHost);
    restoreEnv("ATLAS_HOST_URL", originalHostUrl);
  }
});

test("atlas dev requires an explicit host URL in non-interactive mode", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-required-host-url-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify(testTypeScriptConfig()));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  framework: "react",',
    '  routes: [{ hostId: "customer-host", basePath: "/orders" }]',
    "};"
  ].join("\n"));
  const originalHostUrl = process.env.ATLAS_HOST_URL;
  delete process.env.ATLAS_HOST_URL;

  try {
    await expect(runDevService(root, projectRoot, ["dev", "orders", "--prepare-only"])).rejects.toThrow(/Host URL is required\. Pass --host-url or set ATLAS_HOST_URL\./);
  } finally {
    restoreEnv("ATLAS_HOST_URL", originalHostUrl);
  }
});

test("atlas dev prompts for a missing host URL in interactive mode", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-prompt-host-url-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify(testTypeScriptConfig()));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  framework: "react",',
    '  routes: [{ hostId: "customer-host", basePath: "/orders" }]',
    "};"
  ].join("\n"));
  const originalHostUrl = process.env.ATLAS_HOST_URL;
  delete process.env.ATLAS_HOST_URL;

  try {
    const stdout = await runDevService(root, projectRoot, ["dev", "orders", "--prepare-only"], {
      interactive: true,
      input: async (message) => {
        expect(message).toBe("Host URL for local development");
        return "https://customer.example/orders";
      },
      select: async (message, choices) => {
        expect(message).toBe("Save this host configuration to project .env.local?");
        return choices.find((choice) => choice.value === "no")!.value;
      }
    });
    expect(stdout).toMatch(/App Preview: https:\/\/customer\.example\/orders/);
  } finally {
    restoreEnv("ATLAS_HOST_URL", originalHostUrl);
  }
});

test("atlas dev prompts for a route when a base host URL matches multiple routes", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-prompt-route-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify(testTypeScriptConfig()));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  framework: "react",',
    '  routes: [',
    '    { hostId: "customer-host", basePath: "/orders" },',
    '    { hostId: "customer-host", basePath: "/admin/orders" }',
    "  ]",
    "};"
  ].join("\n"));
  const originalHostUrl = process.env.ATLAS_HOST_URL;
  process.env.ATLAS_HOST_URL = "https://customer.example";

  try {
    const stdout = await runDevService(root, projectRoot, ["dev", "orders", "--prepare-only"], {
      interactive: true,
      input: async () => { throw new Error("Host URL should not be prompted"); },
      select: async (message, choices) => {
        expect(message).toBe("Route opened for local development");
        expect(choices.map((choice) => choice.value)).toStrictEqual(["/orders", "/admin/orders"]);
        const selected = choices.find((choice) => choice.value === "/admin/orders");
        if (!selected) throw new Error("Expected admin route choice.");
        return selected.value;
      }
    });
    expect(stdout).toMatch(/App Preview: https:\/\/customer\.example\/admin\/orders/);
  } finally {
    restoreEnv("ATLAS_HOST_URL", originalHostUrl);
  }
});

test("atlas dev keeps a full ATLAS_HOST_URL with multiple routes", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-full-host-url-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify(testTypeScriptConfig()));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  framework: "react",',
    '  routes: [',
    '    { hostId: "customer-host", basePath: "/orders" },',
    '    { hostId: "customer-host", basePath: "/admin/orders" }',
    "  ]",
    "};"
  ].join("\n"));
  const originalHostUrl = process.env.ATLAS_HOST_URL;
  process.env.ATLAS_HOST_URL = "https://customer.example/custom/path?mode=dev";

  try {
    const stdout = await runDevService(root, projectRoot, ["dev", "orders", "--prepare-only"]);
    expect(stdout).toMatch(/App Preview: https:\/\/customer\.example\/custom\/path\?mode=dev/);
  } finally {
    restoreEnv("ATLAS_HOST_URL", originalHostUrl);
  }
});

test("atlas dev prompts when multiple configured hosts are possible", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-multi-host-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify(testTypeScriptConfig()));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  framework: "angular",',
    '  routes: [',
    '    { hostId: "customer-host", basePath: "/orders" },',
    '    { hostId: "admin-host", basePath: "/admin/orders" }',
    "  ]",
    "};"
  ].join("\n"));
  const originalHost = process.env.ATLAS_HOST_ID;
  const originalHostUrl = process.env.ATLAS_HOST_URL;
  delete process.env.ATLAS_HOST_ID;
  delete process.env.ATLAS_HOST_URL;

  try {
    await runDevService(root, projectRoot, ["dev", "orders", "--host-url=https://admin.example/admin/orders", "--prepare-only"], {
      interactive: true,
      input: async () => { throw new Error("Host input should not be prompted."); },
      select: async (message, choices) => {
        if (message === "Save this host configuration to project .env.local?") {
          return choices.find((choice) => choice.value === "no")!.value;
        }
        const selected = choices.find((choice) => choice.value === "admin-host");
        if (!selected) throw new Error("Expected admin host choice.");
        return selected.value;
      }
    });

    const document = JSON.parse(await readFile(join(projectRoot, ".atlas/local-overrides.json"), "utf8"));
    expect(document.hostId).toBe("admin-host");
  } finally {
    restoreEnv("ATLAS_HOST_ID", originalHost);
    restoreEnv("ATLAS_HOST_URL", originalHostUrl);
  }
});

test("atlas dev offers to save prompted host configuration to project .env.local", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-save-host-env-"));
  const projectRoot = join(root, "orders");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, ".env.local"), "UNCHANGED=value\n");
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify(testTypeScriptConfig()));
  await writeFile(join(projectRoot, "atlas.config.ts"), [
    "export default {",
    '  id: "orders",',
    '  framework: "react",',
    '  routes: [{ hostId: "customer-host", basePath: "/orders" }]',
    "};"
  ].join("\n"));
  const originalHost = process.env.ATLAS_HOST_ID;
  const originalHostUrl = process.env.ATLAS_HOST_URL;
  delete process.env.ATLAS_HOST_ID;
  delete process.env.ATLAS_HOST_URL;

  try {
    await runDevService(root, projectRoot, ["dev", "orders", "--prepare-only"], {
      interactive: true,
      input: async () => "https://customer.example/orders",
      select: async (message, choices) => {
        expect(message).toBe("Save this host configuration to project .env.local?");
        return choices.find((choice) => choice.value === "yes")!.value;
      }
    });
    expect(await readFile(join(projectRoot, ".env.local"), "utf8")).toBe([
      "UNCHANGED=value",
      "ATLAS_HOST_ID=customer-host",
      "ATLAS_HOST_URL=https://customer.example/orders",
      ""
    ].join("\n"));
    delete process.env.ATLAS_HOST_ID;
    delete process.env.ATLAS_HOST_URL;
    await loadEnvFiles(projectRoot);
    expect(process.env.ATLAS_HOST_ID).toBe("customer-host");
    expect(process.env.ATLAS_HOST_URL).toBe("https://customer.example/orders");
  } finally {
    restoreEnv("ATLAS_HOST_ID", originalHost);
    restoreEnv("ATLAS_HOST_URL", originalHostUrl);
  }
});


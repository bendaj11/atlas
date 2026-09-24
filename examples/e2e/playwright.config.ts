import { defineConfig } from "@playwright/test";
import { join, resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "../..");
const cdnPort = process.env.ATLAS_E2E_CDN_PORT ?? "4400";
const externalCdnPort = process.env.ATLAS_E2E_EXTERNAL_CDN_PORT ?? "4401";
const reactHostPort = process.env.ATLAS_E2E_REACT_HOST_PORT ?? "4300";
const angularHostPort = process.env.ATLAS_E2E_ANGULAR_HOST_PORT ?? "4301";
const artifacts = resolve(workspaceRoot, process.env.ATLAS_E2E_ARTIFACTS_DIR ?? "examples/e2e/.artifacts");

function staticServerCommand(directory: string, port: string, spa = false) {
  const argumentsList = [
    "tsx",
    join(import.meta.dirname, "static-server.ts"),
    `--root=${join(artifacts, directory)}`,
    `--port=${port}`,
    ...(spa ? ["--spa"] : [])
  ];

  return argumentsList.map((argument) => JSON.stringify(argument)).join(" ");
}

export default defineConfig({
  testDir: ".",
  testMatch: "*.specs.ts",
  outputDir: process.env.ATLAS_E2E_OUTPUT_DIR ?? "test-results",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]] : "line",
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: [
    {
      command: staticServerCommand("cdn", cdnPort),
      url: `http://127.0.0.1:${cdnPort}/registry.json`,
      reuseExistingServer: !process.env.CI
    },
    {
      command: staticServerCommand("external-cdn", externalCdnPort),
      url: `http://127.0.0.1:${externalCdnPort}/registry.json`,
      reuseExistingServer: !process.env.CI
    },
    {
      command: staticServerCommand("react-bootstrap", reactHostPort, true),
      url: `http://127.0.0.1:${reactHostPort}/atlas.runtime.json`,
      reuseExistingServer: !process.env.CI
    },
    {
      command: staticServerCommand("angular-bootstrap", angularHostPort, true),
      url: `http://127.0.0.1:${angularHostPort}/atlas.runtime.json`,
      reuseExistingServer: !process.env.CI
    }
  ]
});

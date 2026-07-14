import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "*.specs.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: [
    {
      command: "node tests/e2e/static-server.mjs --root=tests/e2e/.artifacts/cdn --port=4400",
      url: "http://127.0.0.1:4400/registry.json",
      reuseExistingServer: !process.env.CI
    },
    {
      command: "node tests/e2e/static-server.mjs --root=tests/e2e/.artifacts/external-cdn --port=4401",
      url: "http://127.0.0.1:4401/registry.json",
      reuseExistingServer: !process.env.CI
    },
    {
      command: "node examples/hosts/demo-react-host/server/dist/main.mjs",
      url: "http://127.0.0.1:4300/health/ready",
      env: {
        PORT: "4300",
        ATLAS_CATALOG_URL: "http://127.0.0.1:4400/hosts/demo-react-host/catalog.json",
        ATLAS_ASSET_ORIGINS: "http://127.0.0.1:4400,http://127.0.0.1:4401",
        ATLAS_EXTERNAL_REGISTRY_URLS: "http://127.0.0.1:4401",
        ATLAS_ALLOW_OVERRIDES: "true"
      },
      reuseExistingServer: !process.env.CI
    },
    {
      command: "node examples/hosts/demo-angular-host/server/dist/main.mjs",
      url: "http://127.0.0.1:4301/health/ready",
      env: {
        PORT: "4301",
        ATLAS_CATALOG_URL: "http://127.0.0.1:4400/hosts/demo-angular-host/catalog.json",
        ATLAS_ASSET_ORIGINS: "http://127.0.0.1:4400,http://127.0.0.1:4401",
        ATLAS_EXTERNAL_REGISTRY_URLS: "http://127.0.0.1:4401",
        ATLAS_ALLOW_OVERRIDES: "true"
      },
      reuseExistingServer: !process.env.CI
    }
  ]
});

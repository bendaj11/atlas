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
      command: "node tests/e2e/static-server.js --root=tests/e2e/.artifacts/cdn --port=4400",
      url: "http://127.0.0.1:4400/registry.json",
      reuseExistingServer: !process.env.CI
    },
    {
      command: "node tests/e2e/static-server.js --root=tests/e2e/.artifacts/external-cdn --port=4401",
      url: "http://127.0.0.1:4401/registry.json",
      reuseExistingServer: !process.env.CI
    },
    {
      command: "node tests/e2e/static-server.js --root=tests/e2e/.artifacts/react-bootstrap --port=4300 --spa",
      url: "http://127.0.0.1:4300/atlas.runtime.json",
      reuseExistingServer: !process.env.CI
    },
    {
      command: "node tests/e2e/static-server.js --root=tests/e2e/.artifacts/angular-bootstrap --port=4301 --spa",
      url: "http://127.0.0.1:4301/atlas.runtime.json",
      reuseExistingServer: !process.env.CI
    }
  ]
});

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "*.spec.ts",
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
      command: "node tests/e2e/static-server.mjs --root=examples/hosts/demo-react-host/dist --port=4300 --spa",
      url: "http://127.0.0.1:4300",
      reuseExistingServer: !process.env.CI
    },
    {
      command: "node tests/e2e/static-server.mjs --root=examples/hosts/demo-angular-host/dist/demo-angular-host/browser --port=4301 --spa",
      url: "http://127.0.0.1:4301",
      reuseExistingServer: !process.env.CI
    }
  ]
});

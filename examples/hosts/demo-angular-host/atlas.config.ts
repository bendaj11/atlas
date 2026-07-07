import type { AtlasConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "demo-angular-host",
  name: "Demo Angular Host",
  framework: "angular",
  runtime: {
    catalogUrl: "http://localhost:4400/hosts/demo-angular-host/catalog.json",
    allowedRemoteOrigins: ["http://127.0.0.1:4400"],
    requireIntegrity: true,
    allowRuntimeOverrides: true,
    requestTimeoutMs: 10000,
    retryAttempts: 2,
    retryDelayMs: 250,
    loadTimeoutMs: 15000,
    waitForMfReady: true,
    loadingIndicator: "spinner"
  }
} satisfies AtlasConfig;

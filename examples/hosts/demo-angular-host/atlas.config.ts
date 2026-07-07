import type { AtlasHostConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "demo-angular-host",
  name: "Demo Angular Host",
  framework: "angular",
  allowAppOverrides: true,
  resourcesTimeoutMs: 15000,
  resourcesRetryCount: 3
} satisfies AtlasHostConfig;

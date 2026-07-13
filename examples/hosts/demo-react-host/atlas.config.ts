import type { AtlasHostConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  type: "host",
  id: "demo-react-host",
  name: "Demo React Host",
  framework: "react",
  allowAppOverrides: true,
  resourcesTimeoutMs: 15000,
  resourcesRetryCount: 3
} satisfies AtlasHostConfig;

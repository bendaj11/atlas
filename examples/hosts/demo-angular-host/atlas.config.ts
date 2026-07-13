import type { AtlasHostConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  type: "host",
  id: "demo-angular-host",
  name: "Demo Angular Host",
  framework: "angular"
} satisfies AtlasHostConfig;

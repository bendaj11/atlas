import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  type: "app",
  id: "9a703156-6c63-47bb-aa10-d3d3a1b2a38b",
  name: "Dashboard Angular",
  framework: "angular",
  externalAppsDependencies: ["745518fc-3b1a-4197-b044-da306b0a02ff"],
  routes: [{ hostId: "399e1a5d-f83d-4248-96ed-e4211707ae1b", basePath: "/dashboard-angular", title: "Dashboard Angular", nav: { label: "Dashboard Angular", visible: true, order: 2 } }]
} satisfies AtlasAppConfig;

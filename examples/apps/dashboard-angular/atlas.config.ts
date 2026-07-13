import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  type: "app",
  id: "dashboard-angular",
  name: "Dashboard Angular",
  framework: "angular",
  externalAppsDependencies: ["external-shared-ui"],
  routes: [{ hostId: "demo-angular-host", basePath: "/dashboard-angular", title: "Dashboard Angular", nav: { label: "Dashboard Angular", visible: true, order: 2 } }]
} satisfies AtlasAppConfig;

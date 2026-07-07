import type { AtlasMicrofrontendConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "dashboard-angular",
  name: "Dashboard Angular",
  framework: "angular",
  routes: [{ id: "dashboard-angular-route", hostId: "demo-angular-host", basePath: "/dashboard-angular", title: "Dashboard Angular", nav: { label: "Dashboard Angular", visible: true, order: 2 } }]
} satisfies AtlasMicrofrontendConfig;

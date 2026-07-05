import type { AtlasConfig } from "@atlas/contracts" with { "resolution-mode": "import" };

export default {
  id: "dashboard-angular",
  name: "Dashboard Angular",
  framework: "angular",
  hostCompatibility: ["demo-angular-host"],
  uses: ["catalog-react/product-count"],
  placements: [{ id: "dashboard-angular-route", kind: "route", hostId: "demo-angular-host", route: { id: "dashboard-angular", basePath: "/dashboard-angular", title: "Dashboard Angular", nav: { label: "Dashboard Angular", visible: true, order: 2 } } }]
} satisfies AtlasConfig;

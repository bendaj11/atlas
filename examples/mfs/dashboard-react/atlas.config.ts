import type { AtlasConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "dashboard-react",
  name: "Dashboard React",
  framework: "react",
  hostCompatibility: ["demo-react-host"],
  uses: ["orders-angular/order-status"],
  placements: [{ id: "dashboard-react-route", kind: "route", hostId: "demo-react-host", route: { id: "dashboard-react", basePath: "/dashboard", title: "Dashboard React", nav: { label: "Dashboard", visible: true } } }]
} satisfies AtlasConfig;

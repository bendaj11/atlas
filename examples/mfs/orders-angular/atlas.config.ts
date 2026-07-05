import type { AtlasConfig } from "@atlas/contracts" with { "resolution-mode": "import" };

export default {
  id: "orders-angular",
  name: "Orders Angular",
  framework: "angular",
  hostCompatibility: ["demo-angular-host", "demo-react-host"],
  placements: [
    { id: "orders-angular-route", kind: "route", hostId: "demo-angular-host", route: { id: "orders-angular", basePath: "/orders-angular", title: "Orders Angular", nav: { label: "Orders Angular", visible: true } } },
    { id: "orders-angular-react-host-route", kind: "route", hostId: "demo-react-host", route: { id: "orders-angular", basePath: "/angular-orders", title: "Orders Angular", nav: { label: "Angular Orders", visible: true, order: 30 } } }
  ]
} satisfies AtlasConfig;

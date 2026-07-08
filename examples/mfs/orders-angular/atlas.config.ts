import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "orders-angular",
  name: "Orders Angular",
  framework: "angular",
  routes: [
    { hostId: "demo-angular-host", basePath: "/orders-angular", title: "Orders Angular", nav: { label: "Orders Angular", visible: true } },
    { hostId: "demo-react-host", basePath: "/angular-orders", title: "Orders Angular", nav: { label: "Angular Orders", visible: true, order: 30 } }
  ]
} satisfies AtlasAppConfig;

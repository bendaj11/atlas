import type { AtlasMicrofrontendConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "orders-angular",
  name: "Orders Angular",
  framework: "angular",
  routes: [
    { id: "orders-angular-route", hostId: "demo-angular-host", basePath: "/orders-angular", title: "Orders Angular", nav: { label: "Orders Angular", visible: true } },
    { id: "orders-angular-react-host-route", hostId: "demo-react-host", basePath: "/angular-orders", title: "Orders Angular", nav: { label: "Angular Orders", visible: true, order: 30 } }
  ]
} satisfies AtlasMicrofrontendConfig;

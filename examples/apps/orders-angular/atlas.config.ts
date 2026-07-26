import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  type: "app",
  id: "f856e01e-0fc1-4a6d-a4ec-622c68100d14",
  name: "Orders Angular",
  framework: "angular",
  routes: [
    { hostId: "399e1a5d-f83d-4248-96ed-e4211707ae1b", basePath: "/orders-angular", title: "Orders Angular", nav: { label: "Orders Angular", visible: true } },
    { hostId: "060a7f62-1c95-402c-9993-55749faf36d9", basePath: "/angular-orders", title: "Orders Angular", nav: { label: "Angular Orders", visible: true, order: 30 } }
  ]
} satisfies AtlasAppConfig;

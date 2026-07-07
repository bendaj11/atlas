import type { AtlasMicrofrontendConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "dashboard-react",
  name: "Dashboard React",
  framework: "react",
  routes: [{ id: "dashboard-react-route", hostId: "demo-react-host", basePath: "/dashboard", title: "Dashboard React", nav: { label: "Dashboard", visible: true } }]
} satisfies AtlasMicrofrontendConfig;

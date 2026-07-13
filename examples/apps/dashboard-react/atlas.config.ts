import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  type: "app",
  id: "dashboard-react",
  name: "Dashboard React",
  framework: "react",
  routes: [{ hostId: "demo-react-host", basePath: "/dashboard", title: "Dashboard React", nav: { label: "Dashboard", visible: true } }]
} satisfies AtlasAppConfig;

import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  type: "app",
  id: "56e41bf1-d1b4-486f-a340-5782ee632bad",
  name: "Dashboard React",
  framework: "react",
  routes: [{ hostId: "060a7f62-1c95-402c-9993-55749faf36d9", basePath: "/dashboard", title: "Dashboard React", nav: { label: "Dashboard", visible: true } }]
} satisfies AtlasAppConfig;

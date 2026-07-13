import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  type: "app",
  id: "catalog-react",
  name: "Catalog React",
  framework: "react",
  routes: [
    { hostId: "demo-react-host", basePath: "/catalog", title: "Catalog React", nav: { label: "Catalog", visible: true } },
    { hostId: "demo-angular-host", basePath: "/react-catalog", title: "Catalog React", nav: { label: "React Catalog", visible: true, order: 30 } }
  ]
} satisfies AtlasAppConfig;

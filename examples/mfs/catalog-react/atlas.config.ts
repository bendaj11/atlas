import type { AtlasMicrofrontendConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "catalog-react",
  name: "Catalog React",
  framework: "react",
  routes: [
    { id: "catalog-react-route", hostId: "demo-react-host", basePath: "/catalog", title: "Catalog React", nav: { label: "Catalog", visible: true } },
    { id: "catalog-react-angular-host-route", hostId: "demo-angular-host", basePath: "/react-catalog", title: "Catalog React", nav: { label: "React Catalog", visible: true, order: 30 } }
  ]
} satisfies AtlasMicrofrontendConfig;

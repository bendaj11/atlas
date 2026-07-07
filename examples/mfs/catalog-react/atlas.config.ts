import type { AtlasConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "catalog-react",
  name: "Catalog React",
  framework: "react",
  hostCompatibility: ["demo-react-host", "demo-angular-host", "backoffice-host"],
  placements: [
    { id: "catalog-react-route", kind: "route", hostId: "demo-react-host", route: { id: "catalog-react", basePath: "/catalog", title: "Catalog React", nav: { label: "Catalog", visible: true } } },
    { id: "catalog-react-angular-host-route", kind: "route", hostId: "demo-angular-host", route: { id: "catalog-react", basePath: "/react-catalog", title: "Catalog React", nav: { label: "React Catalog", visible: true, order: 30 } } }
  ]
} satisfies AtlasConfig;

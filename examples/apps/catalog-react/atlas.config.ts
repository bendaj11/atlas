import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  type: "app",
  id: "3ae54928-c2c6-491d-b766-6996ce0ef3c8",
  name: "Catalog React",
  framework: "react",
  routes: [
    { hostId: "060a7f62-1c95-402c-9993-55749faf36d9", basePath: "/catalog", title: "Catalog React", nav: { label: "Catalog", visible: true } },
    { hostId: "399e1a5d-f83d-4248-96ed-e4211707ae1b", basePath: "/react-catalog", title: "Catalog React", nav: { label: "React Catalog", visible: true, order: 30 } }
  ]
} satisfies AtlasAppConfig;

import type { AtlasGeneratedFile } from "@atlas/generators";
import type { SupportedFramework } from "./arguments.js";

const ATLAS_INTEGRATION_FILES = new Set([
  "atlas.config.ts",
  "federation.config.js"
]);

const DELEGATED_HOST_FILES: Record<SupportedFramework, ReadonlySet<string>> = {
  angular: new Set([
    ...ATLAS_INTEGRATION_FILES,
    "src/index.html",
    "src/styles.css",
    "src/app/app.component.ts",
    "src/app/atlas-host-default-route.component.ts",
    "src/main.ts",
    "src/bootstrap.ts"
  ]),
  react: new Set([
    ...ATLAS_INTEGRATION_FILES,
    "vite.config.ts",
    "index.html",
    "src/styles.css",
    "src/atlas-bootstrap.ts",
    "src/main.tsx"
  ])
};

const DELEGATED_APP_FILES: Record<SupportedFramework, ReadonlySet<string>> = {
  angular: new Set([
    ...ATLAS_INTEGRATION_FILES,
    "src/index.html",
    "src/styles.css",
    "src/assets/.gitkeep",
    "src/main.ts",
    "src/app/README.md",
    "src/app/app.component.ts",
    "src/app/home/home.component.ts",
    "src/app/details/details.component.ts",
    "src/app/routes.ts",
    "src/entry.ts",
    "src/exported-widgets/README.md"
  ]),
  react: new Set([
    ...ATLAS_INTEGRATION_FILES,
    "vite.config.ts",
    "index.html",
    "src/styles.css",
    "src/app/README.md",
    "src/app/App.tsx",
    "src/app/home/Home.tsx",
    "src/app/details/Details.tsx",
    "src/app/routes.tsx",
    "src/main.tsx",
    "src/entry.tsx",
    "src/exported-widgets/README.md"
  ])
};

export function generatedOverlay(
  files: AtlasGeneratedFile[],
  workspaceScaffolded: boolean,
  type: "host" | "app",
  framework: SupportedFramework
): AtlasGeneratedFile[] {
  if (!workspaceScaffolded) return files;
  const overlay = type === "host" ? DELEGATED_HOST_FILES[framework] : DELEGATED_APP_FILES[framework];
  return files.filter((file) => overlay.has(file.path));
}

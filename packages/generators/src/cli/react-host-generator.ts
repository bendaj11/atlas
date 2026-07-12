import type { ReactVersionProfile } from "./generator-versions.js";

export function reactHostMain(profile: ReactVersionProfile): string {
  const rootImport = profile.major === 17
    ? 'import { render } from "react-dom";'
    : 'import { flushSync } from "react-dom";\nimport { createRoot } from "react-dom/client";';
  const mount = profile.major === 17
    ? `render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
  root
);`
    : `const reactRoot = createRoot(root);
flushSync(() =>
  reactRoot.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
);`;
  return `import { StrictMode } from "react";
${rootImport}
import { RouterProvider } from "react-router-dom";
import { router, startAtlasHost } from "./atlas-bootstrap";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error('Atlas React host root was not found. Suggested action: Add <div id="root"></div> to host index.html, then reload.');

${mount}

void startAtlasHost();
`;
}

export function reactHostBootstrap(): string {
  return `import "es-module-shims";
import { createBrowserRouter } from "react-router-dom";
import { initFederation, loadRemoteModule } from "@softarc/native-federation-runtime";
import { AtlasDefaultHostLayout, startHost } from "@atlas/runtime/react";
import atlasConfig from "../atlas.config";

export const router = createBrowserRouter([{ path: "*", Component: AtlasDefaultHostLayout }]);

export async function startAtlasHost(): Promise<void> {
  await startHost({
    router,
    federation: { initFederation, loadRemoteModule },
    hostData: { hostId: atlasConfig.id, name: atlasConfig.name }
  }).catch((error) => console.error("Atlas host failed to start:", error instanceof Error ? error.message : String(error), "Suggested action: Fix reported host configuration or resource failure, then reload host."));
}
`;
}

import type { ReactVersionProfile } from "./generator-versions.js";

export function reactHostMain(profile: ReactVersionProfile): string {
  const rootImport = profile.major === 17
    ? 'import { render, unmountComponentAtNode } from "react-dom";'
    : 'import { flushSync } from "react-dom";\nimport { createRoot } from "react-dom/client";';
  const mount = profile.major === 17
    ? `render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
  root
);
if (import.meta.hot) import.meta.hot.dispose(() => unmountComponentAtNode(root));`
    : `const reactRoot = createRoot(root);
flushSync(() =>
  reactRoot.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
);
if (import.meta.hot) import.meta.hot.dispose(() => reactRoot.unmount());`;
  return `import "es-module-shims";
import { StrictMode } from "react";
${rootImport}
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { initFederation, loadRemoteModule } from "@softarc/native-federation-runtime";
import { AtlasHostShell, startHost } from "@atlas/runtime/react";
import { createFetchAtlasHttpClient, type AtlasHostData } from "@atlas/sdk";
import atlasConfig from "../atlas.config";
import "./styles.css";

const router = createBrowserRouter([{ path: "*", Component: AtlasHostShell }]);
const root = document.getElementById("root");
if (!root) throw new Error("Atlas React host root was not found.");
const hostData: AtlasHostData = {
  hostId: atlasConfig.id,
  name: atlasConfig.name ?? atlasConfig.id
};

${mount}

void startHost({
  router,
  federation: { initFederation, loadRemoteModule },
  showToast: (toast) => console.info("[Atlas toast]", toast.title),
  hostData,
  httpClient: createFetchAtlasHttpClient(fetch)
}).catch((error) => console.error("Atlas host failed to start", error));
`;
}

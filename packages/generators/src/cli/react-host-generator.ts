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
  return `import "es-module-shims";
import { StrictMode } from "react";
${rootImport}
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { createDomOverlayProviders } from "@atlas/sdk/overlay";
import { initFederation, loadRemoteModule } from "@softarc/native-federation-runtime";
import { AtlasDefaultHostLayout, startHost } from "@atlas/runtime/react";
import atlasConfig from "../atlas.config";
import "./styles.css";

const router = createBrowserRouter([{ path: "*", Component: AtlasDefaultHostLayout }]);
const overlayDefaults = createDomOverlayProviders(document);
const root = document.getElementById("root");
if (!root) throw new Error("Atlas React host root was not found.");

${mount}

void startHost({
  router,
  federation: { initFederation, loadRemoteModule },
  showToast: (toast) => console.info("[Atlas toast]", toast.title),
  openModal: (modal, controls) => {
    console.info("[Atlas modal]", modal.id ?? modal.component);
    controls.dismiss();
    return {
      id: modal.id ?? "atlas-modal-default",
      closed: Promise.resolve(undefined),
      close: () => controls.dismiss(),
      dismiss: () => controls.dismiss()
    };
  },
  openPopup: overlayDefaults.openPopup,
  hostData: { hostId: atlasConfig.id, name: atlasConfig.name }
}).catch((error) => console.error("Atlas host failed to start", error));
`;
}

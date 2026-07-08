import "es-module-shims";
import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { createDomOverlayProviders } from "@atlas/sdk/overlay";
import { initFederation, loadRemoteModule } from "@softarc/native-federation-runtime";
import { AtlasDefaultHostLayout, startHost } from "@atlas/runtime/react";
import type { AtlasHostData } from "@atlas/sdk";
import atlasConfig from "../atlas.config";
import "./styles.css";

const router = createBrowserRouter([{ path: "*", Component: AtlasDefaultHostLayout }]);
const overlayDefaults = createDomOverlayProviders(document);
const root = document.getElementById("root");
if (!root) throw new Error("Atlas React host root was not found.");
const hostData: AtlasHostData = { hostId: atlasConfig.id, name: atlasConfig.name ?? atlasConfig.id };
const reactRoot = createRoot(root);
flushSync(() => reactRoot.render(<StrictMode><RouterProvider router={router} /></StrictMode>));
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
  hostData,
  onStateChange: (event) => { if (event.error) console.error("[Atlas MF error]", event.manifest.id, event.error); }
}).catch((error) => console.error("Atlas host failed to start", error));

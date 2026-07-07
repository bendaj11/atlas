import "es-module-shims";
import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { initFederation, loadRemoteModule } from "@softarc/native-federation-runtime";
import { startHost } from "@atlas/runtime/react";
import { createFetchAtlasHttpClient, type AtlasHostData } from "@atlas/sdk";
import atlasConfig from "../atlas.config";
import "./styles.css";

function Shell() { return <><div data-atlas-host-status /><header><strong>Atlas</strong><div data-atlas-slot="header" /></header><nav data-atlas-navigation aria-label="Application" /><main data-atlas-route-outlet /></>; }
const router = createBrowserRouter([{ path: "*", Component: Shell }]);
const root = document.getElementById("root");
if (!root) throw new Error("Atlas React host root was not found.");
const hostData: AtlasHostData = { hostId: atlasConfig.id, name: atlasConfig.name ?? atlasConfig.id };
const reactRoot = createRoot(root);
flushSync(() => reactRoot.render(<StrictMode><RouterProvider router={router} /></StrictMode>));
if (import.meta.hot) import.meta.hot.dispose(() => reactRoot.unmount());
void startHost({
  router,
  federation: { initFederation, loadRemoteModule },
  showToast: (toast) => console.info("[Atlas toast]", toast.title),
  getCurrentUser: async () => ({ id: "local-user", displayName: "Local Developer" }),
  hostData,
  httpClient: createFetchAtlasHttpClient(fetch),
  onStateChange: (event) => { if (event.error) console.error("[Atlas MF error]", event.manifest.id, event.error); }
}).catch((error) => console.error("Atlas host failed to start", error));

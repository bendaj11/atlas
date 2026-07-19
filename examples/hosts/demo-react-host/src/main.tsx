import "es-module-shims";
import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { initFederation, loadRemoteModule } from "@atlas/sdk/federation";
import { AtlasDefaultHostLayout, startHost } from "@atlas/runtime/react";
import type { AtlasHostData } from "@atlas/sdk";
import atlasConfig from "../atlas.config";
import "./styles.css";

const router = createBrowserRouter([{ path: "*", Component: AtlasDefaultHostLayout }]);
const root = document.getElementById("root");
if (!root) throw new Error("Atlas React host root was not found.");
const hostData: AtlasHostData = { hostId: atlasConfig.id, name: atlasConfig.name ?? atlasConfig.id };
const reactRoot = createRoot(root);
flushSync(() => reactRoot.render(<StrictMode><RouterProvider router={router} /></StrictMode>));
void startHost({
  router,
  federation: { initFederation, loadRemoteModule },
  hostData
}).catch((error) => console.error("Atlas host failed to start", error));

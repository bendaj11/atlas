import "es-module-shims";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { initFederation, loadRemoteModule } from "@atlas/sdk/federation";
import { AtlasDefaultHostLayout, startHost } from "@atlas/runtime/react";
import type { AtlasHostClientEntry } from "@atlas/sdk/lifecycle";
import atlasConfig from "../atlas.config";
import "./styles.css";

export const mount: AtlasHostClientEntry["mount"] = async (request) => {
  const router = createBrowserRouter([{ path: "*", Component: AtlasDefaultHostLayout }]);
  const root = createRoot(request.container);
  root.render(<StrictMode><RouterProvider router={router} /></StrictMode>);
  const runtime = await startHost({
    router,
    federation: { initFederation, loadRemoteModule },
    hostData: { hostId: atlasConfig.id, name: atlasConfig.name ?? atlasConfig.id },
    runtimeConfig: request.runtimeConfig,
    catalog: request.catalog
  });
  return { async unmount() { await runtime.stop(); root.unmount(); } };
};

import type { ReactVersionProfile } from './generator-versions.js';

export function reactHostBootstrap(profile: ReactVersionProfile): string {
  const imports =
    profile.major === 17
      ? 'import { render, unmountComponentAtNode } from "react-dom";'
      : 'import { flushSync } from "react-dom";\nimport { createRoot } from "react-dom/client";';
  const renderHost =
    profile.major === 17
      ? 'render(element, container);\n  return { unmount: () => unmountComponentAtNode(container) };'
      : 'const root = createRoot(container);\n  flushSync(() => root.render(element));\n  return { unmount: () => root.unmount() };';
  return `import "es-module-shims";
import { StrictMode } from "react";
${imports}
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { initFederation, loadRemoteModule } from "@atlas/sdk/federation";
import type { AtlasHostClientEntry } from "@atlas/sdk/lifecycle";
import {
  AtlasHostProvider,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
  AtlasSlot
} from "@atlas/runtime/react";
import atlasConfig from "../atlas.config";
import "./styles.css";

type HostMountRequest = Pick<Parameters<AtlasHostClientEntry["mount"]>[0], "container"> &
  Partial<Omit<Parameters<AtlasHostClientEntry["mount"]>[0], "container">>;

function HostLayout() {
  return (
    <>
      <AtlasHostStatus />
      <header>
        <strong>Atlas</strong>
        <AtlasSlot name="header" />
      </header>
      <AtlasNavigation aria-label="Application" />
      <AtlasRouteOutlet />
    </>
  );
}

function mountHost(request: HostMountRequest) {
  const router = createBrowserRouter([{ path: "*", Component: HostLayout }]);
  const element = (
    <StrictMode>
      <AtlasHostProvider
        hostId={atlasConfig.id}
        options={{
          router,
          federation: { initFederation, loadRemoteModule },
          hostData: { hostId: atlasConfig.id, name: atlasConfig.name },
          ...(request.runtimeConfig ? { runtimeConfig: request.runtimeConfig } : {}),
          ...(request.catalog ? { catalog: request.catalog } : {})
        }}
      >
        <RouterProvider router={router} />
      </AtlasHostProvider>
    </StrictMode>
  );
  const container = request.container;
  ${renderHost}
};

export const mount: AtlasHostClientEntry["mount"] = mountHost;
`;
}

export function reactHostMain(): string {
  return `import { mount } from "./bootstrap";

const root = document.getElementById("root");
if (!root) throw new Error("React root is missing.");

void mount({ container: root });
`;
}

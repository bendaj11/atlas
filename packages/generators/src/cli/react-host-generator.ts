import { title } from "./common-generator.js";
import type { ReactVersionProfile } from "./generator-versions.js";

export function reactHostMain(name: string, profile: ReactVersionProfile): string {
  const providerName = reactHostProviderName(name);
  const rootImport = profile.major === 17
    ? 'import { render } from "react-dom";'
    : 'import { flushSync } from "react-dom";\nimport { createRoot } from "react-dom/client";';
  const mount = profile.major === 17
    ? `render(
  <StrictMode>
    <${providerName}>
      <RouterProvider router={router} />
    </${providerName}>
  </StrictMode>,
  root
);`
    : `const reactRoot = createRoot(root);
flushSync(() =>
  reactRoot.render(
    <StrictMode>
      <${providerName}>
        <RouterProvider router={router} />
      </${providerName}>
    </StrictMode>
  )
);`;
  return `import { StrictMode } from "react";
${rootImport}
import { RouterProvider } from "react-router-dom";
import { router } from "./atlas-bootstrap";
import { ${providerName} } from "./${providerName}";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error('Atlas React host root was not found. Suggested action: Add <div id="root"></div> to host index.html, then reload.');

${mount}
`;
}

export function reactHostBootstrap(): string {
  return `import { createBrowserRouter } from "react-router-dom";
import { AtlasDefaultHostLayout } from "@atlas/runtime/react";

export const router = createBrowserRouter([{ path: "*", Component: AtlasDefaultHostLayout }]);
`;
}

export function reactHostProvider(name: string): string {
  const providerName = reactHostProviderName(name);
  return `import "es-module-shims";
import type { PropsWithChildren } from "react";
import { initFederation, loadRemoteModule } from "@atlas/sdk/federation";
import { AtlasHostProvider } from "@atlas/runtime/react";
import atlasConfig from "../atlas.config";
import { router } from "./atlas-bootstrap";

export function ${providerName}({ children }: PropsWithChildren) {
  return (
    <AtlasHostProvider
      hostId={atlasConfig.id}
      options={{
        router,
        federation: { initFederation, loadRemoteModule },
        hostData: { hostId: atlasConfig.id, name: atlasConfig.name }
      }}
    >
      {children}
    </AtlasHostProvider>
  );
}
`;
}

export function reactHostProviderName(name: string): string {
  const hostName = title(name).replaceAll(" ", "");
  const componentName = /^[A-Za-z_$]/.test(hostName) ? hostName : `Host${hostName}`;
  return `${componentName}AtlasProvider`;
}

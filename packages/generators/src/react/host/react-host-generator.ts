import type { ReactVersionProfile } from '../../shared/versions/generator-versions.types.js';

export function renderReactHostBootstrap(profile: ReactVersionProfile): string {
  const legacy = profile.major <= 17;
  const reactDomImport = legacy
    ? 'import { render, unmountComponentAtNode } from "react-dom";'
    : 'import { createRoot } from "react-dom/client";';
  const reactDom = legacy
    ? '{ render, unmountComponentAtNode }'
    : '{ createRoot }';

  return `import "es-module-shims";
${reactDomImport}
import { defineReactHost } from "@atlas/runtime/react";
import atlasConfig from "../atlas.config";
import { HostLayout } from "./host-layout";
import { HostProviders, useCustomHostSdkOptions, type CustomerHostSdk } from "./host.config";
import "./styles.css";

export const mount = defineReactHost<CustomerHostSdk>({
  config: atlasConfig,
  layout: HostLayout,
  reactDom: ${reactDom},
  providers: HostProviders,
  useSdkOptions: useCustomHostSdkOptions
});
`;
}

export function renderReactHostLayout(): string {
  return `import {
  AtlasHostLayout,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
  AtlasSlot
} from "@atlas/runtime/react";

export function HostLayout() {
  return (
    <AtlasHostLayout layoutId="default">
      <AtlasHostStatus />
      <header>
        <strong>Atlas</strong>
        <AtlasSlot slotId="header" />
      </header>
      <AtlasNavigation aria-label="Application" />
      <AtlasRouteOutlet />
    </AtlasHostLayout>
  );
}
`;
}

export function renderReactHostSdkConfig(): string {
  return `import { StrictMode, type ReactNode } from "react";
import type { HostSdkOptions } from "@atlas/runtime/react";

/** Add product-specific host SDK capabilities here. Hooks are supported. */
export interface CustomerHostSdk {}

/** Wrap the host with product providers here, such as a query client. */
export function HostProviders({ children }: { children?: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}

export function useCustomHostSdkOptions(): HostSdkOptions<CustomerHostSdk> {
  return {};
}
`;
}

export function renderReactHostMain(): string {
  return `const root = document.getElementById("root");
if (!root) throw new Error("React root is missing.");

root.textContent = "Start this Atlas host with atlas dev.";
`;
}

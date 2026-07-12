import { createContext, createElement as createReactElement, useContext, type ReactElement, type ReactNode } from "react";
import type { AtlasAppContext } from "./lifecycle.js";
import type { AtlasSdk } from "./host.js";

export const AtlasSdkContext = createContext<AtlasSdk | undefined>(undefined);
export const AtlasRuntimeContext = createContext<AtlasAppContext | undefined>(undefined);

export function AtlasSdkProvider({ sdk, children }: { sdk: AtlasSdk; children: ReactNode }): ReactElement {
  return createReactElement(AtlasSdkContext.Provider, { value: sdk }, children);
}

export function useAtlasSdk<THostSdk extends object = {}>(): AtlasSdk<THostSdk> {
  const sdk = useContext(AtlasSdkContext);
  if (!sdk) throw new Error("useAtlasSdk must be used inside an Atlas app.");
  return sdk as AtlasSdk<THostSdk>;
}

export function useAppLoaded(): () => void {
  const context = useContext(AtlasRuntimeContext);
  if (!context) throw new Error("useAppLoaded must be used inside an Atlas app.");
  return context.loading.waitUntilReady();
}

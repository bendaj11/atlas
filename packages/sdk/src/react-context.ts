import { createContext, createElement as createReactElement, useContext, type ReactElement, type ReactNode } from "react";
import type { AtlasAppContext } from "./lifecycle.js";
import type { AtlasEventMap, AtlasSdk as AtlasSdkValue } from "./host.js";
import { createReactAtlasSdk, type ReactAtlasSdk } from "./react-widget.js";
import { sdkError } from "./sdk-error.js";

export type AtlasSdk<THostSdk extends object = {}, TEvents extends object = AtlasEventMap> = ReactAtlasSdk<THostSdk, TEvents>;

export const AtlasSdkContext = createContext<AtlasSdkValue | undefined>(undefined);
export const AtlasRuntimeContext = createContext<AtlasAppContext | undefined>(undefined);

export function AtlasSdkProvider<THostSdk extends object = {}, TEvents extends object = AtlasEventMap>({ sdk, children }: { sdk: AtlasSdkValue<THostSdk, TEvents>; children: ReactNode }): ReactElement {
  return createReactElement(AtlasSdkContext.Provider, { value: sdk as unknown as AtlasSdkValue }, children);
}

export function useAtlasSdk<THostSdk extends object = {}, TEvents extends object = AtlasEventMap>(): AtlasSdk<THostSdk, TEvents> {
  const sdk = useContext(AtlasSdkContext);
  if (!sdk) {
    throw sdkError(
      "Atlas SDK is unavailable because useAtlasSdk was called outside AtlasSdkProvider.",
      {
        suggestedActions: "Render this component below AtlasSdkProvider, then reload the app.",
        code: "ATLAS_REACT_SDK_CONTEXT_MISSING"
      }
    );
  }
  return createReactAtlasSdk(sdk as AtlasSdkValue<THostSdk, TEvents>);
}

export function useAppLoaded(): () => void {
  const context = useContext(AtlasRuntimeContext);
  if (!context) {
    throw sdkError(
      "Atlas app loading context is unavailable because useAppLoaded was called outside an Atlas-mounted app.",
      {
        suggestedActions: "Call useAppLoaded only from a component rendered by the Atlas app mount lifecycle.",
        code: "ATLAS_REACT_APP_CONTEXT_MISSING"
      }
    );
  }
  return context.loading.waitUntilReady();
}

import {
  createContext,
  createElement as createReactElement,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { AtlasAppContext } from '../../lifecycle.js';
import {
  subscribeAtlasHostData,
  type AtlasEventMap,
  type AtlasSdk as AtlasSdkValue,
} from '../../host.js';
import {
  createReactAtlasSdk,
  type ReactAtlasSdk,
} from '../react-widget/react-widget.js';
import { sdkError } from '../../core/sdk-error/sdk-error.js';

export type AtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
> = ReactAtlasSdk<THostSdk, TEvents>;

export const AtlasSdkContext = createContext<AtlasSdkValue | undefined>(
  undefined,
);
const AtlasHostDataContext = createContext<object | undefined>(undefined);
export const AtlasRuntimeContext = createContext<AtlasAppContext | undefined>(
  undefined,
);
export const AtlasStyleTargetContext = createContext<
  (Node & ParentNode) | undefined
>(undefined);

export function AtlasSdkProvider<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
>({
  sdk,
  children,
}: {
  sdk: AtlasSdkValue<THostSdk, TEvents>;
  children: ReactNode;
}): ReactElement {
  const subscribe = useCallback(
    (notify: () => void) => subscribeAtlasHostData(sdk, notify),
    [sdk],
  );
  const hostData = useSyncExternalStore(subscribe, () => sdk.hostData);

  return createReactElement(
    AtlasSdkContext.Provider,
    { value: sdk as unknown as AtlasSdkValue },
    createReactElement(
      AtlasHostDataContext.Provider,
      { value: hostData },
      children,
    ),
  );
}

export function useAtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
>(): AtlasSdk<THostSdk, TEvents> {
  const sdk = useContext(AtlasSdkContext);
  useContext(AtlasHostDataContext);
  const context = useContext(AtlasRuntimeContext);
  if (!sdk) {
    throw sdkError(
      'Atlas SDK is unavailable because useAtlasSdk was called outside AtlasSdkProvider.',
      {
        suggestedActions:
          'Render this component below AtlasSdkProvider, then reload the app.',
        code: 'ATLAS_SDK_CONTEXT_MISSING',
      },
    );
  }

  return createReactAtlasSdk(sdk as AtlasSdkValue<THostSdk, TEvents>, context);
}

export function useAppLoaded(): () => void {
  const context = useContext(AtlasRuntimeContext);
  if (!context) {
    throw sdkError(
      'Atlas app loading context is unavailable because useAppLoaded was called outside an Atlas-mounted app.',
      {
        suggestedActions:
          'Call useAppLoaded only from a component rendered by the Atlas app mount lifecycle.',
        code: 'ATLAS_APP_CONTEXT_MISSING',
      },
    );
  }

  return context.loading.waitUntilReady();
}

/** Returns the Atlas boundary for CSS-in-JS libraries that support a custom insertion target. */
export function useAtlasStyleTarget(): Node & ParentNode {
  const styleTarget = useContext(AtlasStyleTargetContext);
  if (styleTarget) return styleTarget;
  throw sdkError(
    'Atlas style target is unavailable because useAtlasStyleTarget was called outside an Atlas-mounted app.',
    {
      suggestedActions:
        'Call useAtlasStyleTarget only from a component rendered by the Atlas app mount lifecycle.',
      code: 'ATLAS_STYLE_TARGET_MISSING',
    },
  );
}

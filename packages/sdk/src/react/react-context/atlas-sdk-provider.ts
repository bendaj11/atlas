import {
  createElement as createReactElement,
  useCallback,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  subscribeAtlasHostData,
  type AtlasEventMap,
  type AtlasSdk as AtlasSdkValue,
} from '../../host.js';
import { AtlasHostDataContext, AtlasSdkContext } from './contexts.js';

export interface AtlasSdkProviderProps<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
> {
  sdk: AtlasSdkValue<THostSdk, TEvents>;
  children: ReactNode;
}

/** Provides the host SDK and re-renders consumers whenever host data changes. */
export function AtlasSdkProvider<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
>({ sdk, children }: AtlasSdkProviderProps<THostSdk, TEvents>): ReactElement {
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

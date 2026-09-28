import { createElement, type ReactElement, type ReactNode } from 'react';
import {
  AtlasRuntimeContext,
  AtlasSdkProvider,
  AtlasStyleTargetContext,
} from '@atlas/sdk/react';
import type { MockAtlasEnvironment } from '../atlas-environment/atlas-environment.types.js';

export interface MockAtlasEnvironmentProviderProps<
  THostSdk extends object,
  TEvents extends object,
> {
  environment: MockAtlasEnvironment<THostSdk, TEvents>;
  children?: ReactNode;
}

export function MockAtlasEnvironmentProvider<
  THostSdk extends object,
  TEvents extends object,
>({
  environment,
  children,
}: MockAtlasEnvironmentProviderProps<THostSdk, TEvents>): ReactElement {
  const runtimeElement = createElement(
    AtlasRuntimeContext.Provider,
    { value: environment.context },
    children,
  );

  return createElement(AtlasSdkProvider<THostSdk, TEvents>, {
    sdk: environment.sdk,
    children: createElement(
      AtlasStyleTargetContext.Provider,
      { value: document.head },
      runtimeElement,
    ),
  });
}

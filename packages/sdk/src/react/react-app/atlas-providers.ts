import { createElement as createReactElement, type ReactNode } from 'react';
import type {
  AtlasAppMountRequest,
  AtlasExportedWidgetMountRequest,
} from '../../lifecycle.js';
import {
  AtlasRuntimeContext,
  AtlasSdkProvider,
  AtlasStyleTargetContext,
} from '../react-context/index.js';

type ProviderRequest = Pick<
  AtlasAppMountRequest,
  'sdk' | 'styleTarget' | 'context'
>;

/** Wraps an app or widget element with the SDK, style target, and runtime context providers. */
export function withAtlasProviders(
  request: ProviderRequest | AtlasExportedWidgetMountRequest<object>,
  element: unknown,
): ReactNode {
  const runtimeElement = createReactElement(
    AtlasRuntimeContext.Provider,
    { value: request.context },
    element as ReactNode,
  );

  return createReactElement(AtlasSdkProvider, {
    sdk: request.sdk,
    children: createReactElement(AtlasStyleTargetContext.Provider, {
      value: request.styleTarget,
      children: runtimeElement,
    }),
  });
}

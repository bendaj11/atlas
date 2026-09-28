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
import { AtlasErrorBoundary } from './atlas-error-boundary.js';

type ProviderRequest = Pick<
  AtlasAppMountRequest,
  'sdk' | 'styleTarget' | 'context'
>;

/** Wraps an app or widget element with the SDK, style target, and runtime context providers and an error boundary that reports render errors to the host. */
export function withAtlasProviders(
  request: ProviderRequest | AtlasExportedWidgetMountRequest<object>,
  element: ReactNode,
): ReactNode {
  const runtimeElement = createReactElement(
    AtlasRuntimeContext.Provider,
    { value: request.context },
    createReactElement(AtlasErrorBoundary, {
      context: request.context,
      children: element,
    }),
  );

  return createReactElement(AtlasSdkProvider, {
    sdk: request.sdk,
    children: createReactElement(AtlasStyleTargetContext.Provider, {
      value: request.styleTarget,
      children: runtimeElement,
    }),
  });
}

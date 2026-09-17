import { useContext } from 'react';
import type { AtlasEventMap, AtlasSdk as AtlasSdkValue } from '../../host.js';
import { AtlasSdkError } from '../../core/sdk-error/sdk-error.js';
import {
  createReactAtlasSdk,
  type ReactAtlasSdk,
} from '../react-widget/index.js';
import {
  AtlasHostDataContext,
  AtlasRuntimeContext,
  AtlasSdkContext,
} from './contexts.js';

export type AtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
> = ReactAtlasSdk<THostSdk, TEvents>;

/** Returns the React facade of the host SDK; the host-data context subscription keeps consumers fresh. */
export function useAtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
>(): AtlasSdk<THostSdk, TEvents> {
  const sdk = useContext(AtlasSdkContext);
  useContext(AtlasHostDataContext);
  const context = useContext(AtlasRuntimeContext);

  if (!sdk) {
    throw new AtlasSdkError(
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

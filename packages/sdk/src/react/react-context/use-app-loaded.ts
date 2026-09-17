import { useContext } from 'react';
import { AtlasSdkError } from '../../core/sdk-error/sdk-error.js';
import { AtlasRuntimeContext } from './contexts.js';

/** Defers host readiness until the returned callback runs; only valid inside an Atlas-mounted app. */
export function useAppLoaded(): () => void {
  const context = useContext(AtlasRuntimeContext);

  if (!context) {
    throw new AtlasSdkError(
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

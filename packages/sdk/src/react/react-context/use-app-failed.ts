import { useContext } from 'react';
import { AtlasSdkError } from '../../core/sdk-error/sdk-error.js';
import { AtlasRuntimeContext } from './contexts.js';

/** Returns a callback that reports an unrecoverable app failure to the host; only valid inside an Atlas-mounted app. */
export function useAppFailed(): (error: unknown) => void {
  const context = useContext(AtlasRuntimeContext);

  if (!context) {
    throw new AtlasSdkError(
      'Atlas app context is unavailable because useAppFailed was called outside an Atlas-mounted app.',
      {
        suggestedActions:
          'Call useAppFailed only from a component rendered by the Atlas app mount lifecycle.',
        code: 'ATLAS_APP_CONTEXT_MISSING',
      },
    );
  }

  return (error) => context.fail(error);
}

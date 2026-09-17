import { useContext } from 'react';
import { sdkError } from '../../core/sdk-error/sdk-error.js';
import { AtlasStyleTargetContext } from './contexts.js';

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

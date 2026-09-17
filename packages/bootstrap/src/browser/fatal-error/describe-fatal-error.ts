import { AtlasError, errorSummary } from '@atlas/schema';
import type { BootstrapFailure } from './fatal-error.types.js';
import { suggestedActionsFor } from './suggested-actions-for.js';

const MESSAGE_PREFIX = 'Atlas could not start this page: ';
const FALLBACK_CODE = 'ATLAS_BOOTSTRAP_FAILED';

export function describeFatalError(error: unknown): BootstrapFailure {
  if (error instanceof AtlasError) {
    return {
      message: MESSAGE_PREFIX + error.summary,
      suggestedActions: [...error.suggestedActions],
      code: error.code ?? FALLBACK_CODE,
      cause: error,
    };
  }

  const cause = error instanceof Error ? error : new Error(String(error));
  const detail = errorSummary(cause.message);

  return {
    message: MESSAGE_PREFIX + detail,
    suggestedActions: suggestedActionsFor(detail),
    code: FALLBACK_CODE,
    cause,
  };
}

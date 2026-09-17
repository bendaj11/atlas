import { AtlasError } from '@atlas/schema';
import type { BootstrapErrorCode } from '../bootstrap-error-code.js';
import { SUGGESTED_ACTIONS } from '../suggested-actions.js';

export interface BootstrapErrorOptions {
  code: BootstrapErrorCode;
  message: string;
  cause?: unknown;
}

export function bootstrapError({
  code,
  message,
  cause,
}: BootstrapErrorOptions): AtlasError {
  return new AtlasError(message, {
    code,
    suggestedActions: SUGGESTED_ACTIONS[code],
    ...(cause === undefined ? {} : { cause }),
  });
}

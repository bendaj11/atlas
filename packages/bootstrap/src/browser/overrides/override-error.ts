import type { AtlasError } from '@atlas/schema';
import { bootstrapError } from '../../shared/errors/index.js';

export function overrideError(message: string): AtlasError {
  return bootstrapError({ code: 'OVERRIDE_INVALID', message });
}

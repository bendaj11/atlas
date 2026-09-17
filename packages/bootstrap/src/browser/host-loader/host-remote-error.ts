import type { AtlasError } from '@atlas/schema';
import { bootstrapError } from '../../shared/errors/index.js';

export function hostRemoteError(message: string): AtlasError {
  return bootstrapError({ code: 'HOST_REMOTE_INVALID', message });
}

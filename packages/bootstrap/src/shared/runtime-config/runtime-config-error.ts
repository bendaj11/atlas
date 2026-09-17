import type { AtlasError } from '@atlas/schema';
import { bootstrapError } from '../errors/index.js';

export function runtimeConfigError(message: string): AtlasError {
  return bootstrapError({ code: 'RUNTIME_CONFIG_INVALID', message });
}

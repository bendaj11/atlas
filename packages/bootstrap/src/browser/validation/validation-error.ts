import type { AtlasError } from '@atlas/schema';
import type { BootstrapErrorCode } from '../../shared/errors/index.js';
import { bootstrapError } from '../../shared/errors/index.js';

export function describeManifest(manifest: {
  kind: string;
  id: string;
}): string {
  return `${manifest.kind} manifest "${manifest.id}"`;
}

export function validationError({
  code,
  message,
}: {
  code: Extract<
    BootstrapErrorCode,
    'CATALOG_INVALID' | 'HOST_MANIFEST_INVALID' | 'ARTIFACT_URL_REJECTED'
  >;
  message: string;
}): AtlasError {
  return bootstrapError({ code, message });
}

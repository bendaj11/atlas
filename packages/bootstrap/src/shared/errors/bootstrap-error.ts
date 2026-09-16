import { AtlasError } from '@atlas/schema';

export type BootstrapErrorCode =
  | 'RUNTIME_CONFIG_INVALID'
  | 'DEPLOYMENT_INVALID'
  | 'CATALOG_INVALID'
  | 'HOST_MANIFEST_INVALID'
  | 'ARTIFACT_URL_REJECTED'
  | 'ARTIFACT_VERIFICATION_FAILED'
  | 'OVERRIDE_INVALID'
  | 'RESOURCE_UNAVAILABLE'
  | 'HOST_REMOTE_INVALID'
  | 'MODULE_LOADER_UNAVAILABLE'
  | 'HOST_MOUNT_FAILED'
  | 'BOOTSTRAP_TEMPLATE_INVALID';

const SUGGESTED_ACTIONS: Record<BootstrapErrorCode, readonly string[]> = {
  RUNTIME_CONFIG_INVALID: [
    'Verify /atlas.runtime.json matches the Atlas runtime config schema and names the intended host and environment.',
    'Correct the deployed runtime config, then reload.',
  ],
  DEPLOYMENT_INVALID: [
    'Verify the environment manifest at the environment registry returns valid Atlas JSON for this host and environment.',
    'Redeploy the host to this environment, then reload.',
  ],
  CATALOG_INVALID: [
    'Verify the host catalog names this host and only contains app manifests.',
    'Publish a host catalog compatible with this Atlas loader, then reload.',
  ],
  HOST_MANIFEST_INVALID: [
    'Verify the selected host manifest names this host, exposes an entry, and targets a compatible Atlas loader API.',
    'Publish a host client compatible with this Atlas loader, then reload.',
  ],
  ARTIFACT_URL_REJECTED: [
    'Verify atlas.runtime.json registry origins and the selected artifact remote-entry URL.',
    'Publish the artifact from an approved HTTPS origin, or serve local builds from loopback, then reload.',
  ],
  ARTIFACT_VERIFICATION_FAILED: [
    'Verify the published artifact bytes match the descriptor recorded in the registry.',
    'Republish the artifact with matching SHA-256 integrity, then reload.',
  ],
  OVERRIDE_INVALID: [
    'Select Clear overrides and reload below.',
    'If the page then works, correct or disable the invalid override in Columbus before enabling it again.',
  ],
  RESOURCE_UNAVAILABLE: [
    'Open the failed URL from the error details and verify it is reachable.',
    'Correct the deployment, authentication, or CORS policy, then reload.',
  ],
  HOST_REMOTE_INVALID: [
    'Verify the selected host remote entry exposes the configured entry and declares valid shared dependencies.',
    'Rebuild and republish the host client, then reload.',
  ],
  MODULE_LOADER_UNAVAILABLE: [
    'Verify /es-module-shims.js is served next to the bootstrap page.',
    'Rebuild and redeploy the host bootstrap, then reload.',
  ],
  HOST_MOUNT_FAILED: [
    'Verify the bootstrap page contains #atlas-host-root and the selected host client exports mount(request).',
    'Rebuild and redeploy the host bootstrap and host client, then reload.',
  ],
  BOOTSTRAP_TEMPLATE_INVALID: [
    'Keep an element with id="atlas-host-root" and a script element loading /atlas.loader.js in the bootstrap template.',
  ],
};

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

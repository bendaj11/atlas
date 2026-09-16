import type { CliArguments } from '../../cli/arguments.js';
import type { ArtifactoryOptions } from '../artifactory-storage/artifactory-storage.js';
import {
  positiveEnvironmentInteger,
  requiredStorageValue,
} from '../storage-environment/storage-environment.js';

export function artifactoryOptionsFromEnvironment(
  args?: CliArguments,
): ArtifactoryOptions {
  const lockResource = requiredStorageValue({
    args,
    flag: 'lock-resource',
    environmentName: 'ATLAS_ARTIFACTORY_LOCK_RESOURCE',
  });

  return {
    url: requiredStorageValue({
      args,
      flag: 'storage-api-url',
      environmentName: 'ATLAS_STORAGE_API_URL',
    }),
    repository: requiredStorageValue({
      args,
      flag: 'repository',
      environmentName: 'ATLAS_ARTIFACTORY_REPOSITORY',
    }),
    prefix:
      args?.flag('key-prefix') ??
      process.env.ATLAS_STORAGE_KEY_PREFIX ??
      'atlas',
    accessToken: requiredStorageValue({
      environmentName: 'ATLAS_ARTIFACTORY_ACCESS_TOKEN',
    }),
    publicUrl: artifactoryPublicUrl(args),
    requestTimeoutMs: positiveEnvironmentInteger(
      'ATLAS_ARTIFACTORY_REQUEST_TIMEOUT_MS',
    ),
    maxBufferedBytes: positiveEnvironmentInteger(
      'ATLAS_ARTIFACTORY_MAX_BUFFERED_BYTES',
    ),
    assertExclusivePublishing: () => {
      if (process.env.ATLAS_PUBLICATION_LOCK !== lockResource) {
        throw new Error(
          `Artifactory writes require the shared external lock "${lockResource}". Run the entire Atlas command inside Jenkins lock(resource: '${lockResource}', variable: 'ATLAS_PUBLICATION_LOCK').`,
        );
      }
    },
  };
}

function artifactoryPublicUrl(args?: CliArguments): string {
  if (args?.command === 'deploy') {
    const target =
      args.flag('target-registry-url') ?? process.env.ATLAS_TARGET_REGISTRY_URL;
    if (target) return target;
  }

  return requiredStorageValue({
    args,
    flag: 'registry-url',
    environmentName: 'ATLAS_REGISTRY_URL',
  });
}

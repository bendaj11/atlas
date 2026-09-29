import {
  stringifyCanonicalJson,
  type AtlasPublicationLease,
  type AtlasPublicationStorage,
} from '../../publication/index.js';
import {
  forEachConcurrently,
  MUTABLE_CACHE_CONTROL,
} from '../../shared/index.js';
import {
  buildEnvironmentStatePath,
  buildHostManifestPath,
} from '../registry-access/registry-access.js';
import type { DeploymentWrite } from '../types.js';

export async function writeDeployment({
  storage,
  lease,
  environment,
  deployment,
  concurrency,
}: {
  storage: AtlasPublicationStorage;
  lease: AtlasPublicationLease;
  environment: string;
  deployment: DeploymentWrite;
  concurrency: number;
}): Promise<void> {
  await forEachConcurrently({
    items: deployment.manifests,
    concurrency,
    operation: (manifest) =>
      writeJsonObject({
        storage,
        lease,
        path: buildHostManifestPath({ environment, hostId: manifest.hostId }),
        value: manifest,
      }),
  });
  await writeJsonObject({
    storage,
    lease,
    path: buildEnvironmentStatePath(environment),
    value: deployment.state,
  });
}

async function writeJsonObject({
  storage,
  lease,
  path,
  value,
}: {
  storage: AtlasPublicationStorage;
  lease: AtlasPublicationLease;
  path: string;
  value: unknown;
}): Promise<void> {
  await lease.assertHeld();

  const bytes = new TextEncoder().encode(`${stringifyCanonicalJson(value)}\n`);
  const previous = await storage.inspect(path);

  await storage.replace(
    path,
    bytes,
    { cacheControl: MUTABLE_CACHE_CONTROL, contentType: 'application/json' },
    previous?.versionToken
      ? { versionToken: previous.versionToken }
      : { createOnly: true },
  );
}

import type { AtlasHostManifest, AtlasHostRuntimeConfig } from '@atlas/schema';
import { validateArtifactUrl } from '../validate-artifact-url/validate-artifact-url.js';
import { HostManifestInvalidError } from '../../../shared/errors/index.js';
import { describeManifest } from '../describe-manifest.js';
import { LOADER_API_VERSION } from '../validation.constants.js';

export function validateHostManifest({
  manifest,
  runtime,
}: {
  manifest: AtlasHostManifest;
  runtime: AtlasHostRuntimeConfig;
}): void {
  if (manifest.kind !== 'host' || manifest.id !== runtime.hostId) {
    throw new HostManifestInvalidError(
      `Selected host manifest must be a host manifest with id "${runtime.hostId}", got ${describeManifest(manifest)}.`,
    );
  }

  if (typeof manifest.exposes.entry !== 'string') {
    throw new HostManifestInvalidError(
      `Selected host manifest "${manifest.id}" has no entry expose.`,
    );
  }

  const requiredMajor = Number(
    manifest.requiredLoaderApiVersion.match(/\d+/)?.[0],
  );
  const providedMajor = Number(LOADER_API_VERSION.split('.')[0]);

  if (requiredMajor !== providedMajor) {
    throw new HostManifestInvalidError(
      `Selected host manifest "${manifest.id}" requires Atlas loader API ${manifest.requiredLoaderApiVersion} but this loader provides ${LOADER_API_VERSION}.`,
    );
  }

  validateArtifactUrl({
    url: new URL(manifest.remoteEntryUrl),
    manifest,
    runtime,
  });
}

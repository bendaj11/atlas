import type {
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
} from '@atlas/schema';
import { isLoopbackHostname } from '@atlas/schema';
import { ArtifactUrlRejectedError } from '../../../shared/errors/index.js';
import { describeManifest } from '../describe-manifest.js';

export function validateArtifactUrl({
  url,
  manifest,
  runtime,
}: {
  url: URL;
  manifest: AtlasHostManifest | AtlasManifest;
  runtime: AtlasHostRuntimeConfig;
}): void {
  const subject = `${describeManifest(manifest)} URL "${url.href}"`;

  if (manifest.channel === 'local') {
    validateLocalArtifactUrl({ url, subject });

    return;
  }

  const artifactRegistryUrl = new URL(
    runtime.artifactRegistryUrl,
    globalThis.location?.href,
  );
  const loopbackToLoopback =
    url.protocol === 'http:' &&
    isLoopbackHostname(url.hostname) &&
    isLoopbackHostname(artifactRegistryUrl.hostname);

  if (loopbackToLoopback) return;

  if (url.protocol !== 'https:') {
    throw new ArtifactUrlRejectedError(`Published ${subject} must use HTTPS.`);
  }

  if (url.origin !== artifactRegistryUrl.origin) {
    throw new ArtifactUrlRejectedError(
      `Published ${subject} uses origin "${url.origin}" outside artifactRegistryUrl origin "${artifactRegistryUrl.origin}".`,
    );
  }
}

function validateLocalArtifactUrl({
  url,
  subject,
}: {
  url: URL;
  subject: string;
}): void {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ArtifactUrlRejectedError(`Local ${subject} must use HTTP(S).`);
  }

  if (!isLoopbackHostname(url.hostname)) {
    throw new ArtifactUrlRejectedError(
      `Local ${subject} must use a loopback hostname.`,
    );
  }
}

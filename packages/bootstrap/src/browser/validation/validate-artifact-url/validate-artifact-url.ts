import type {
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
} from '@atlas/schema';
import { isLoopbackHostname } from '@atlas/schema';
import { describeManifest, validationError } from '../validation-error.js';

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
    throw artifactUrlError(`Published ${subject} must use HTTPS.`);
  }

  if (url.origin !== artifactRegistryUrl.origin) {
    throw artifactUrlError(
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
    throw artifactUrlError(`Local ${subject} must use HTTP(S).`);
  }

  if (!isLoopbackHostname(url.hostname)) {
    throw artifactUrlError(`Local ${subject} must use a loopback hostname.`);
  }
}

function artifactUrlError(message: string) {
  return validationError({ code: 'ARTIFACT_URL_REJECTED', message });
}

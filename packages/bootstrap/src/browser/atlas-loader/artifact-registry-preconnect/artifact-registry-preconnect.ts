import {
  resolveEnvironmentRegistryUrl,
  type AtlasHostRuntimeConfig,
} from '@atlas/schema';
import type { LoaderDocument } from '../atlas-loader.types.js';

export function preconnectArtifactRegistry({
  document,
  runtime,
  pageUrl,
}: {
  document: LoaderDocument;
  runtime: AtlasHostRuntimeConfig;
  pageUrl: string;
}): void {
  const artifactOrigin = new URL(runtime.artifactRegistryUrl, pageUrl).origin;
  const connectedOrigins = [
    new URL(pageUrl).origin,
    new URL(resolveEnvironmentRegistryUrl(runtime), pageUrl).origin,
  ];

  if (connectedOrigins.includes(artifactOrigin)) return;

  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = artifactOrigin;
  link.crossOrigin = 'anonymous';

  document.head.append(link);
}

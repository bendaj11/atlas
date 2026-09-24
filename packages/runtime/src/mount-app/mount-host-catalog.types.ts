import type { AtlasManifest, AtlasRuntimeOverride } from '@atlas/schema';
import type { FetchBytes } from '../loader/fetch-bytes.js';
import type { AtlasLoaderOptions } from './mount-app.types.js';

export type ResolveAppContainer = (
  manifest: AtlasManifest,
) => HTMLElement | undefined;

export interface AtlasHostCatalogMountOptions extends AtlasLoaderOptions {
  manifestUrl: string;
  artifactRegistryUrl?: string;
  fetchBytes?: FetchBytes;
  overrides?: AtlasRuntimeOverride[];
  resolveContainer: ResolveAppContainer;
}

/** Infrastructure-only helper for custom DOM hosts that mount every catalog app into its own container. */

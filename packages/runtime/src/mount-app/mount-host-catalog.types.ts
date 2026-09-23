import type { AtlasManifest } from '@atlas/schema';
import type { FetchBytes } from '../loader/fetch-bytes.js';
import type { AtlasRuntimeOverride } from '../loader/overrides/overrides.types.js';
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

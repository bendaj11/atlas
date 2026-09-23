import type { AtlasManifest } from '@atlas/schema';
import type { AtlasRetryPolicy } from '../../resilience/resilience.types.js';

export type AtlasRuntimeOverrideReason = 'local' | 'pr' | 'historical';

export interface AtlasRuntimeOverride {
  appId: string;
  manifest: AtlasManifest;
  reason: AtlasRuntimeOverrideReason;
}

export interface AtlasRuntimeOverrideDocument {
  schemaVersion: '1';
  hostId: string;
  overrides: AtlasRuntimeOverride[];
  generatedAt: string;
}

export type OverrideSessionStorage = Pick<Storage, 'getItem'> &
  Partial<Pick<Storage, 'setItem'>>;

export type RequestDevelopmentSession = () => Promise<unknown | undefined>;

export interface AtlasBrowserOverrideOptions {
  hostId: string;
  /** @deprecated Development sessions are provided by the Columbus bridge; this value is ignored. */
  search?: string;
  /** @deprecated Override URLs are never fetched; this value is ignored. */
  fetchJson?: (url: string, signal?: AbortSignal) => Promise<unknown>;
  /** Tab-scoped storage. Its override document takes precedence over origin-wide storage. */
  sessionStorage?: OverrideSessionStorage;
  developmentSession?: RequestDevelopmentSession;
  requestPolicy?: AtlasRetryPolicy;
}

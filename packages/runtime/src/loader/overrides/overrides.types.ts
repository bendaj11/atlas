import type { AtlasRetryPolicy } from '../../resilience/resilience.types.js';

export type OverrideStorage = Pick<Storage, 'getItem'>;

export type RequestDevelopmentSession = () => Promise<unknown | undefined>;

export interface AtlasBrowserOverrideOptions {
  hostId: string;
  /** @deprecated Development sessions are provided by the Columbus bridge; this value is ignored. */
  search?: string;
  /** @deprecated Override URLs are never fetched; this value is ignored. */
  fetchJson?: (url: string, signal?: AbortSignal) => Promise<unknown>;
  /** Tab-scoped storage. Its override document takes precedence over origin-wide storage. */
  sessionStorage?: OverrideStorage;
  localStorage?: OverrideStorage;
  developmentSession?: RequestDevelopmentSession;
  requestPolicy?: AtlasRetryPolicy;
}

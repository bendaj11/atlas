import type { AtlasHostRuntimeConfig } from '@atlas/schema';

export interface FetchOptions {
  url: string;
  runtime?: Pick<
    AtlasHostRuntimeConfig,
    'resourcesRetryCount' | 'resourcesTimeoutMs'
  >;
  verify?: (bytes: Uint8Array) => Promise<void>;
}

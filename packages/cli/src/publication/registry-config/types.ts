import type { AtlasStaticRegistry } from '@atlas/schema';
import type { AtlasPublicationStorageSource } from '../publication-storage/types.js';

export interface AtlasRegistryConfig {
  storage?: AtlasPublicationStorageSource;
  invalidate?: (paths: string[]) => void | Promise<void>;
  hostUrls?: string[];
  resolvePreviewHead?: AtlasPreviewHeadResolver;
  verifyRegistry?: (registry: AtlasStaticRegistry) => void | Promise<void>;
}

export interface AtlasPreviewHeadLookup {
  artifactId: string;
  previewNumber: number;
  gitSha: string;
  gitBranch?: string;
}

export interface AtlasPreviewHeadStatus {
  state: 'open' | 'closed' | 'merged';
  headSha: string;
}

export type AtlasPreviewHeadResolver = (
  preview: AtlasPreviewHeadLookup,
) => AtlasPreviewHeadStatus | Promise<AtlasPreviewHeadStatus>;

import type { AtlasManifestDescriptor } from '@atlas/schema';
import type { AtlasBuildResult } from '../build/index.js';
import type { PublicationProgressReporter } from './publication-files/publication-files.js';

export interface AtlasPublishResult {
  uploaded: string[];
  dryRun: boolean;
  manifest: AtlasManifestDescriptor;
  registryRevision: string;
}

export interface AtlasPreviewRemovalResult {
  removed: boolean;
  registryRevision: string;
}

export interface AtlasPreviewPruneResult {
  checked: number;
  removed: number;
  removedGenerations: number;
  registryRevision: string;
}

export interface AtlasProjectBuilder {
  publication(projectName: string): Promise<AtlasBuildResult>;
}

export type AtlasPublishProgressReporter = PublicationProgressReporter;

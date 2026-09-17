import type { AtlasPublishedArtifactManifest } from '@atlas/schema';
import type { AtlasProject } from '../workspace/index.js';

export type AtlasBuildResult = {
  artifact: 'app' | 'host';
  manifest: AtlasPublishedArtifactManifest;
  project: AtlasProject;
  sourceDirectory: string;
  files: string[];
};

export interface BuildManifestOptions {
  skipCompile?: boolean;
  baseUrl?: string;
}

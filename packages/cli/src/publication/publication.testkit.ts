import type {
  AtlasAppArtifactManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
import { anAppArtifactManifest } from '@atlas/testkit';
import {
  descriptorFor,
  manifestBytes,
} from './static-registry/descriptors/descriptors.js';
import { publishArtifact } from './static-registry/static-registry.js';

export function aRegistryWith(
  manifest: AtlasAppArtifactManifest = anAppArtifactManifest(),
): AtlasStaticRegistry {
  const bytes = manifestBytes(manifest);

  return publishArtifact(
    undefined,
    manifest,
    descriptorFor(`apps/${manifest.id}/manifest.json`, bytes),
  ).registry;
}

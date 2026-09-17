import type {
  AtlasAppArtifactManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
import { anAppArtifactManifest } from '@atlas/testkit';
import {
  createManifestDescriptor,
  encodeManifestBytes,
} from './static-registry/descriptors/descriptors.js';
import { publishArtifact } from './static-registry/static-registry.js';

export function aRegistryWith(
  manifest: AtlasAppArtifactManifest = anAppArtifactManifest(),
): AtlasStaticRegistry {
  const bytes = encodeManifestBytes(manifest);

  return publishArtifact(
    undefined,
    manifest,
    createManifestDescriptor(`apps/${manifest.id}/manifest.json`, bytes),
  ).registry;
}

import type { AtlasHostManifest, AtlasManifest } from '@atlas/schema';
import { hydratePublishedArtifactManifest } from '@atlas/schema';
import { decodeJson } from '../../shared/decode-json.js';
import { artifactUrl } from '@atlas/schema';
import { fetchBytes } from '../fetch-json/index.js';
import { assertBytesMatchDescriptor } from './assert-bytes-match-descriptor.js';
import type {
  LoadPublishedArtifactOptions,
  PublishedArtifactDependencies,
} from './published-artifact.types.js';

export async function loadPublishedArtifact({
  reference,
  runtime,
  dependencies = defaultDependencies(),
}: LoadPublishedArtifactOptions): Promise<AtlasManifest | AtlasHostManifest> {
  const url = artifactUrl(runtime, reference.path);
  const bytes = await dependencies.fetchBytes({ url, runtime });
  await assertBytesMatchDescriptor(bytes, reference);

  return dependencies.hydratePublishedArtifactManifest(decodeJson(bytes), url);
}

function defaultDependencies(): PublishedArtifactDependencies {
  return { fetchBytes, hydratePublishedArtifactManifest };
}

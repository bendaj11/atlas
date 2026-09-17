import type { AtlasHostManifest, AtlasManifest } from '@atlas/schema';
import { artifactUrl, hydratePublishedArtifactManifest } from '@atlas/schema';
import { decodeJson } from '../../shared/decode-json/decode-json.js';
import { fetchBytes } from '../fetch-json/index.js';
import { assertBytesMatchDescriptor } from './assert-bytes-match-descriptor/assert-bytes-match-descriptor.js';
import type {
  LoadPublishedArtifactOptions,
  PublishedArtifactDependencies,
} from './published-artifact.types.js';

export async function loadPublishedArtifact({
  reference,
  runtime,
  dependencies = browserPublishedArtifactDependencies(),
}: LoadPublishedArtifactOptions): Promise<AtlasManifest | AtlasHostManifest> {
  const url = artifactUrl(runtime, reference.path);
  const bytes = await dependencies.fetchBytes({ url, runtime });

  await assertBytesMatchDescriptor(bytes, reference);

  return dependencies.hydratePublishedArtifactManifest(decodeJson(bytes), url);
}

function browserPublishedArtifactDependencies(): PublishedArtifactDependencies {
  return { fetchBytes, hydratePublishedArtifactManifest };
}

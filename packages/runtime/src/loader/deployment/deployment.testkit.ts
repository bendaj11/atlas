import { faker } from '@faker-js/faker';
import type { AtlasHostDeploymentManifest } from '@atlas/schema';
import {
  aHostDeploymentManifest,
  aManifestDescriptor,
} from '@atlas/testkit/internal';
import {
  aSha256DigestOf,
  encodeTextAsBytes,
} from '../../shared/bytes.testkit.js';
import type { DeploymentManifestReference } from './deployment.types.js';

export async function aReferenceTo(
  artifact: unknown,
  overrides: Partial<DeploymentManifestReference> = {},
): Promise<DeploymentManifestReference> {
  const text = JSON.stringify(artifact);

  return {
    ...aManifestDescriptor({
      digest: await aSha256DigestOf(text),
      size: encodeTextAsBytes(text).byteLength,
    }),
    url: faker.internet.url(),
    ...overrides,
  };
}

export function aDeploymentWith(input: {
  host: DeploymentManifestReference;
  apps?: DeploymentManifestReference[];
  widgetProviders?: DeploymentManifestReference[];
  overrides?: Partial<AtlasHostDeploymentManifest>;
}): AtlasHostDeploymentManifest {
  return aHostDeploymentManifest({
    host: input.host,
    apps: input.apps ?? [],
    ...(input.widgetProviders
      ? { widgetProviders: input.widgetProviders }
      : {}),
    ...input.overrides,
  });
}

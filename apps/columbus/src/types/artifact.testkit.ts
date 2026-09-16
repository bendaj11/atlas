import { faker } from '@faker-js/faker';
import { getArtifactKey } from '../scripts/artifact-versions/artifact-version-keys/artifact-version-keys';
import type { Artifact, ArtifactConfiguration, OverrideType } from './artifact';
import { anAppManifest } from '@atlas/testkit';

const OVERRIDE_TYPES: OverrideType[] = ['custom', 'production', 'pr'];

export function anArtifact(overrides: Partial<Artifact> = {}): Artifact {
  const productionArtifactVersion =
    overrides.productionArtifactVersion ?? anAppManifest();

  return {
    key: getArtifactKey(productionArtifactVersion),
    productionArtifactVersion,
    selectedArtifactVersion: faker.helpers.arrayElement([
      anAppManifest(),
      undefined,
    ]),
    overrideType: faker.helpers.arrayElement([...OVERRIDE_TYPES, undefined]),
    sourceDescription: faker.lorem.sentence(),
    loadError: faker.helpers.arrayElement([faker.lorem.sentence(), undefined]),
    overrideEnabled: faker.datatype.boolean(),
    canToggle: faker.datatype.boolean(),
    visible: faker.datatype.boolean(),
    ...overrides,
  };
}

export function anArtifactConfiguration(
  overrides: Partial<ArtifactConfiguration> = {},
): ArtifactConfiguration {
  const artifact = anArtifact(overrides);

  return {
    ...artifact,
    hostId: faker.string.uuid(),
    productionArtifactVersions: [artifact.productionArtifactVersion],
    prArtifactVersions: [anAppManifest({ channel: 'pr' })],
    ...overrides,
  };
}

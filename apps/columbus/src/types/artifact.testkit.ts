import { faker } from '@faker-js/faker';
import { getArtifactKey } from '../scripts/artifact-versions/artifact-version-keys/artifact-version-keys';
import type { Artifact, ArtifactConfiguration } from './artifact';
import { anAppArtifactVersion } from './artifact-version.testkit';

export function anArtifact(overrides: Partial<Artifact> = {}): Artifact {
  const productionArtifactVersion =
    overrides.productionArtifactVersion ?? anAppArtifactVersion();

  return {
    key: getArtifactKey(productionArtifactVersion),
    productionArtifactVersion,
    selectedArtifactVersion: undefined,
    overrideType: undefined,
    sourceDescription: '',
    loadError: undefined,
    overrideEnabled: false,
    canToggle: false,
    visible: false,
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
    prArtifactVersions: [],
    ...overrides,
  };
}

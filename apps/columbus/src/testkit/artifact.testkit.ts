import { faker } from '@faker-js/faker';
import {
  type ArtifactOverrideOptions,
  type ArtifactTableRow,
  OVERRIDE_TYPES,
} from '../types/artifact';
import { anAppManifest } from '@atlas/testkit';

export function anArtifactTableRow(
  overrides: Partial<ArtifactTableRow> = {},
): ArtifactTableRow {
  return {
    deployedArtifactVersion: anAppManifest(),
    selectedOverrideArtifactVersion: faker.helpers.arrayElement([
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

export function anArtifactOverrideOptions(
  overrides: Partial<ArtifactOverrideOptions> = {},
): ArtifactOverrideOptions {
  const deployedArtifactVersion =
    overrides.deployedArtifactVersion ?? anAppManifest();

  return {
    deployedArtifactVersion,
    selectedOverrideArtifactVersion: faker.helpers.arrayElement([
      anAppManifest(),
      undefined,
    ]),
    overrideEnabled: faker.datatype.boolean(),
    productionArtifactVersions: [deployedArtifactVersion],
    prArtifactVersions: [anAppManifest({ channel: 'pr' })],
    ...overrides,
  };
}

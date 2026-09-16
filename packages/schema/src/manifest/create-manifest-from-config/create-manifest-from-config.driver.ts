import { faker } from '@faker-js/faker';
import type { AtlasAppConfig } from '../../config/atlas-config.js';
import { ATLAS_FRAMEWORKS } from '../atlas-framework.js';
import type { AtlasManifest } from '../atlas-manifest.js';
import type { CreateManifestFromConfigInput } from './create-manifest-from-config-input.js';
import { createManifestFromConfig } from './create-manifest-from-config.js';

export class CreateManifestFromConfigDriver {
  private input: CreateManifestFromConfigInput = {
    config: {
      id: faker.string.uuid(),
      framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
    },
    version: faker.system.semver(),
    buildId: faker.string.uuid(),
    remoteEntryUrl: faker.internet.url(),
  };
  private manifest!: AtlasManifest;

  given = {
    config: (config: Partial<AtlasAppConfig>): this => {
      this.input = {
        ...this.input,
        config: { ...this.input.config, ...config },
      };

      return this;
    },
    input: (
      input: Partial<Omit<CreateManifestFromConfigInput, 'config'>>,
    ): this => {
      this.input = { ...this.input, ...input };

      return this;
    },
  };

  when = {
    created: (): void => {
      this.manifest = createManifestFromConfig(this.input);
    },
  };

  get = {
    manifest: (): AtlasManifest => this.manifest,
  };
}

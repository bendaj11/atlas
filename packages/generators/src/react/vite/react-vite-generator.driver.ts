import { faker } from '@faker-js/faker';
import type { AtlasProjectType } from '../../shared/types/generator-types.js';
import { anAtlasId } from '../../testkit/generator-options.testkit.js';
import { reactViteConfig } from './react-vite-generator.js';

export class ReactViteGeneratorDriver {
  private name = anAtlasId();
  private type: AtlasProjectType = faker.helpers.arrayElement<AtlasProjectType>(
    ['host', 'app'],
  );
  private reactMajor?: number;
  private devServerPort?: number;
  private contents!: string;

  readonly given = {
    name: (name: string): this => {
      this.name = name;

      return this;
    },
    type: (type: AtlasProjectType): this => {
      this.type = type;

      return this;
    },
    reactMajor: (reactMajor: number | undefined): this => {
      this.reactMajor = reactMajor;

      return this;
    },
    devServerPort: (devServerPort: number | undefined): this => {
      this.devServerPort = devServerPort;

      return this;
    },
  };

  readonly when = {
    generated: (): void => {
      this.contents = reactViteConfig({
        name: this.name,
        type: this.type,
        reactMajor: this.reactMajor,
        devServerPort: this.devServerPort,
      });
    },
  };

  readonly get = {
    contents: (): string => this.contents,
  };
}

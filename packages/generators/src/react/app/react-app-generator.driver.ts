import { faker } from '@faker-js/faker';
import type { ReactVersionProfile } from '../../shared/versions/generator-versions.js';
import { anAtlasId } from '../../testkit/generator-options.testkit.js';
import { aReactVersionProfile } from '../../testkit/version-profiles.testkit.js';
import {
  reactAppBootstrap,
  reactAppComponent,
  reactAppDetails,
  reactAppHome,
  reactAppRoutes,
} from './react-app-generator.js';

export class ReactAppGeneratorDriver {
  private name = anAtlasId();
  private routed = faker.datatype.boolean();
  private profile: ReactVersionProfile = aReactVersionProfile();
  private contents!: string;

  readonly given = {
    name: (name: string): this => {
      this.name = name;

      return this;
    },
    routed: (routed: boolean): this => {
      this.routed = routed;

      return this;
    },
    profile: (profile: ReactVersionProfile): this => {
      this.profile = profile;

      return this;
    },
  };

  readonly when = {
    bootstrapGenerated: (): void => {
      this.contents = reactAppBootstrap({
        name: this.name,
        routed: this.routed,
        profile: this.profile,
      });
    },
    componentGenerated: (): void => {
      this.contents = reactAppComponent({
        name: this.name,
        routed: this.routed,
      });
    },
    homeGenerated: (): void => {
      this.contents = reactAppHome(this.name);
    },
    detailsGenerated: (): void => {
      this.contents = reactAppDetails();
    },
    routesGenerated: (): void => {
      this.contents = reactAppRoutes();
    },
  };

  readonly get = {
    contents: (): string => this.contents,
  };
}

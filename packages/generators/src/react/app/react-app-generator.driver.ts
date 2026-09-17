import { faker } from '@faker-js/faker';
import type { ReactVersionProfile } from '../../shared/versions/generator-versions.types.js';
import { anAtlasId } from '../../testkit/generator-options.testkit.js';
import { aReactVersionProfile } from '../../testkit/version-profiles.testkit.js';
import {
  renderReactAppBootstrap,
  renderReactAppComponent,
  renderReactAppDetails,
  renderReactAppHome,
  renderReactAppRoutes,
} from './react-app-generator.js';

export class ReactAppGeneratorDriver {
  private name = anAtlasId();
  private routed = faker.datatype.boolean();
  private profile = aReactVersionProfile();
  private contents!: string;

  readonly given = {
    name: (name: string) => {
      this.name = name;

      return this;
    },
    routed: (routed: boolean) => {
      this.routed = routed;

      return this;
    },
    profile: (profile: ReactVersionProfile) => {
      this.profile = profile;

      return this;
    },
  };

  readonly when = {
    bootstrapGenerated: () => {
      this.contents = renderReactAppBootstrap({
        name: this.name,
        routed: this.routed,
        profile: this.profile,
      });
    },
    componentGenerated: () => {
      this.contents = renderReactAppComponent({
        name: this.name,
        routed: this.routed,
      });
    },
    homeGenerated: () => {
      this.contents = renderReactAppHome(this.name);
    },
    detailsGenerated: () => {
      this.contents = renderReactAppDetails();
    },
    routesGenerated: () => {
      this.contents = renderReactAppRoutes();
    },
  };

  readonly get = {
    contents: () => this.contents,
  };
}

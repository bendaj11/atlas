import { faker } from '@faker-js/faker';
import { anAtlasId } from '../../testkit/generator-options.testkit.js';
import {
  renderAngularAppComponent,
  renderAngularAppConfig,
  renderAngularAppDetailsComponent,
  renderAngularAppEntry,
  renderAngularAppHomeComponent,
  renderAngularAppMain,
  renderAngularAppRoutes,
} from './angular-app-generator.js';

export class AngularAppGeneratorDriver {
  private name = anAtlasId();
  private routed = faker.datatype.boolean();
  private zoneless = faker.datatype.boolean();
  private requiresZonelessProvider = faker.datatype.boolean();
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
    zoneless: (zoneless: boolean) => {
      this.zoneless = zoneless;

      return this;
    },
    requiresZonelessProvider: (requiresZonelessProvider: boolean) => {
      this.requiresZonelessProvider = requiresZonelessProvider;

      return this;
    },
  };

  readonly when = {
    configGenerated: () => {
      this.contents = renderAngularAppConfig({
        routed: this.routed,
        requiresZonelessProvider: this.requiresZonelessProvider,
      });
    },
    entryGenerated: () => {
      this.contents = renderAngularAppEntry({
        name: this.name,
        routed: this.routed,
        zoneless: this.zoneless,
      });
    },
    componentGenerated: () => {
      this.contents = renderAngularAppComponent({
        name: this.name,
        routed: this.routed,
      });
    },
    mainGenerated: () => {
      this.contents = renderAngularAppMain();
    },
    homeComponentGenerated: () => {
      this.contents = renderAngularAppHomeComponent(this.name);
    },
    detailsComponentGenerated: () => {
      this.contents = renderAngularAppDetailsComponent();
    },
    routesGenerated: () => {
      this.contents = renderAngularAppRoutes();
    },
  };

  readonly get = {
    contents: () => this.contents,
  };
}

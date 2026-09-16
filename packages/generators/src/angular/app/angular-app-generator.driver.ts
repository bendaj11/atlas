import { faker } from '@faker-js/faker';
import { anAtlasId } from '../../testkit/generator-options.testkit.js';
import {
  angularAppComponent,
  angularAppConfig,
  angularAppDetailsComponent,
  angularAppEntry,
  angularAppHomeComponent,
  angularAppMain,
  angularAppRoutes,
} from './angular-app-generator.js';

export class AngularAppGeneratorDriver {
  private name = anAtlasId();
  private routed = faker.datatype.boolean();
  private zoneless = faker.datatype.boolean();
  private requiresZonelessProvider = faker.datatype.boolean();
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
    zoneless: (zoneless: boolean): this => {
      this.zoneless = zoneless;

      return this;
    },
    requiresZonelessProvider: (requiresZonelessProvider: boolean): this => {
      this.requiresZonelessProvider = requiresZonelessProvider;

      return this;
    },
  };

  readonly when = {
    configGenerated: (): void => {
      this.contents = angularAppConfig({
        routed: this.routed,
        requiresZonelessProvider: this.requiresZonelessProvider,
      });
    },
    entryGenerated: (): void => {
      this.contents = angularAppEntry({
        name: this.name,
        routed: this.routed,
        zoneless: this.zoneless,
      });
    },
    componentGenerated: (): void => {
      this.contents = angularAppComponent({
        name: this.name,
        routed: this.routed,
      });
    },
    mainGenerated: (): void => {
      this.contents = angularAppMain();
    },
    homeComponentGenerated: (): void => {
      this.contents = angularAppHomeComponent(this.name);
    },
    detailsComponentGenerated: (): void => {
      this.contents = angularAppDetailsComponent();
    },
    routesGenerated: (): void => {
      this.contents = angularAppRoutes();
    },
  };

  readonly get = {
    contents: (): string => this.contents,
  };
}

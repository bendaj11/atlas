import { faker } from '@faker-js/faker';
import {
  angularHostAppConfig,
  angularHostBootstrap,
  angularHostComponent,
  angularHostMain,
  angularHostRoutes,
  angularHostSdkConfig,
} from './angular-host-generator.js';

export class AngularHostGeneratorDriver {
  private requiresZonelessProvider = faker.datatype.boolean();
  private contents!: string;

  readonly given = {
    requiresZonelessProvider: (requiresZonelessProvider: boolean): this => {
      this.requiresZonelessProvider = requiresZonelessProvider;

      return this;
    },
  };

  readonly when = {
    appConfigGenerated: (): void => {
      this.contents = angularHostAppConfig({
        requiresZonelessProvider: this.requiresZonelessProvider,
      });
    },
    componentGenerated: (): void => {
      this.contents = angularHostComponent();
    },
    mainGenerated: (): void => {
      this.contents = angularHostMain();
    },
    routesGenerated: (): void => {
      this.contents = angularHostRoutes();
    },
    sdkConfigGenerated: (): void => {
      this.contents = angularHostSdkConfig();
    },
    bootstrapGenerated: (): void => {
      this.contents = angularHostBootstrap();
    },
  };

  readonly get = {
    contents: (): string => this.contents,
  };
}

import { faker } from '@faker-js/faker';
import {
  renderAngularHostAppConfig,
  renderAngularHostBootstrap,
  renderAngularHostComponent,
  renderAngularHostMain,
  renderAngularHostSdkConfig,
} from './angular-host-generator.js';

export class AngularHostGeneratorDriver {
  private requiresZonelessProvider = faker.datatype.boolean();
  private contents!: string;

  readonly given = {
    requiresZonelessProvider: (requiresZonelessProvider: boolean) => {
      this.requiresZonelessProvider = requiresZonelessProvider;

      return this;
    },
  };

  readonly when = {
    appConfigGenerated: () => {
      this.contents = renderAngularHostAppConfig({
        requiresZonelessProvider: this.requiresZonelessProvider,
      });
    },
    componentGenerated: () => {
      this.contents = renderAngularHostComponent();
    },
    mainGenerated: () => {
      this.contents = renderAngularHostMain();
    },
    sdkConfigGenerated: () => {
      this.contents = renderAngularHostSdkConfig();
    },
    bootstrapGenerated: () => {
      this.contents = renderAngularHostBootstrap();
    },
  };

  readonly get = {
    contents: () => this.contents,
  };
}

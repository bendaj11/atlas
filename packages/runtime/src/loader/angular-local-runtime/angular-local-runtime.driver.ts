import type { AtlasFramework, AtlasVersionChannel } from '@atlas/schema';
import { prepareAngularLocalRuntime } from './angular-local-runtime.js';

export class AngularLocalRuntimeDriver {
  private readonly environment: object = {};
  private channel: AtlasVersionChannel = 'local';
  private framework: AtlasFramework = 'angular';

  readonly given = {
    channel: (channel: AtlasVersionChannel) => {
      this.channel = channel;

      return this;
    },
    framework: (framework: AtlasFramework) => {
      this.framework = framework;

      return this;
    },
    ngDevMode: (value: unknown) => {
      Reflect.set(this.environment, 'ngDevMode', value);

      return this;
    },
  };

  readonly when = {
    prepare: () => {
      prepareAngularLocalRuntime(
        { channel: this.channel, framework: this.framework },
        this.environment,
      );
    },
  };

  readonly get = {
    ngDevMode: () => Reflect.get(this.environment, 'ngDevMode'),
    hasNgDevMode: () => Reflect.has(this.environment, 'ngDevMode'),
  };
}

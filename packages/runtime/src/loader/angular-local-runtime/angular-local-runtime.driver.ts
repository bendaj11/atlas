import { prepareAngularLocalRuntime } from './angular-local-runtime.js';

export class AngularLocalRuntimeDriver {
  private readonly environment: object = {};
  private channel: 'local' | 'production' = 'local';
  private framework: 'angular' | 'react' = 'angular';

  readonly given = {
    channel: (channel: 'local' | 'production'): AngularLocalRuntimeDriver => {
      this.channel = channel;
      return this;
    },
    framework: (framework: 'angular' | 'react'): AngularLocalRuntimeDriver => {
      this.framework = framework;
      return this;
    },
    ngDevMode: (value: unknown): AngularLocalRuntimeDriver => {
      Reflect.set(this.environment, 'ngDevMode', value);
      return this;
    },
  };

  readonly when = {
    prepare: (): AngularLocalRuntimeDriver => {
      prepareAngularLocalRuntime(
        { channel: this.channel, framework: this.framework },
        this.environment,
      );
      return this;
    },
  };

  readonly get = {
    ngDevMode: (): unknown => Reflect.get(this.environment, 'ngDevMode'),
    hasNgDevMode: (): boolean => Reflect.has(this.environment, 'ngDevMode'),
  };
}

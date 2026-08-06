import { faker } from '@faker-js/faker';
import type { AtlasConfig, AtlasHostRuntimeConfig } from '@atlas/schema';
import { CliArguments } from '../../cli/arguments.js';
import { createHostRuntimeConfig } from './runtime-config.js';

export class RuntimeConfigDriver {
  private readonly hostId = faker.string.uuid();
  private args = new CliArguments([]);
  private config: AtlasConfig = {
    framework: 'react',
    id: this.hostId,
    name: faker.company.name(),
    type: 'host',
  };
  private hostVersion: string | undefined;
  private runtime?: AtlasHostRuntimeConfig;
  private error?: Error;

  given = {
    arguments: (values: readonly string[]): void => {
      this.args = new CliArguments(values);
    },
    hostConfig: (config: Partial<AtlasConfig>): void => {
      this.config = { ...this.config, ...config } as AtlasConfig;
    },
    hostVersion: (version: string): void => {
      this.hostVersion = version;
    },
  };

  when = {
    create: (): void => {
      try {
        this.runtime = createHostRuntimeConfig(
          this.config,
          this.args,
          this.hostVersion,
        );
      } catch (error) {
        this.error = error as Error;
      }
    },
  };

  get = {
    runtime: (): AtlasHostRuntimeConfig | undefined => this.runtime,
    error: (): (() => void) => () => {
      throw this.error;
    },
    hostId: (): string => this.hostId,
  };
}

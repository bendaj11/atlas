import { faker } from '@faker-js/faker';
import type { AtlasConfig, AtlasHostRuntimeConfig } from '@atlas/schema';
import { createHostRuntimeConfig } from './runtime-config.js';
import { CliArguments } from '../../shared/index.js';

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
    arguments: (values: readonly string[]) => {
      this.args = new CliArguments(values);
    },
    hostConfig: (config: Partial<AtlasConfig>) => {
      this.config = { ...this.config, ...config } as AtlasConfig;
    },
    hostVersion: (version: string) => {
      this.hostVersion = version;
    },
  };

  when = {
    create: () => {
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
    runtime: () => this.runtime,
    error: (): (() => void) => () => {
      throw this.error;
    },
    hostId: () => this.hostId,
  };
}

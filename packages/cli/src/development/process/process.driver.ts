import { faker } from '@faker-js/faker';
import {
  browserOpenCommand,
  formatFrameworkServerError,
  frameworkServerArguments,
  remoteEntryIsReady,
} from './process.js';

type RemoteEntryScenario = 'html' | 'missing' | 'metadata';

export class DevelopmentProcessDriver {
  private ready?: boolean;
  private response?: Response;
  private value?: unknown;

  given = {
    response: (scenario: RemoteEntryScenario): void => {
      if (scenario === 'html') {
        this.response = new Response('<!DOCTYPE html>', {
          headers: { 'content-type': 'text/html' },
          status: 200,
        });

        return;
      }

      if (scenario === 'missing') {
        this.response = new Response(faker.lorem.sentence(), {
          headers: { 'content-type': 'application/json' },
          status: 404,
        });

        return;
      }

      this.response = Response.json({
        exposes: [],
        name: faker.word.noun(),
      });
    },
  };

  when = {
    buildBrowserCommand: (platform: NodeJS.Platform): void => {
      const url = faker.internet.url();
      const result = browserOpenCommand(url, platform);

      this.value = {
        args: result.args.map((argument) =>
          argument === url ? '{url}' : argument,
        ),
        command: result.command,
      };
    },
    check: async (): Promise<void> => {
      if (!this.response) throw new Error('Response setup is required.');

      this.ready = await remoteEntryIsReady(this.response);
    },
    formatFailure: (): void => {
      const message = faker.lorem.sentence();
      const output = faker.lorem.lines(2);

      this.value = {
        error: formatFrameworkServerError(message, output).message,
        message,
        output,
      };
    },
    resolveServerArguments: (
      framework: 'angular' | 'react',
      port: number,
    ): void => {
      this.value = frameworkServerArguments(framework, port);
    },
  };

  get = {
    readiness: (): boolean | undefined => this.ready,
    value: <T>(): T => this.value as T,
  };
}

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import {
  readAngularProxyConfigPath,
  readConfiguredDevServerPort,
} from './config.js';

export class DevelopmentConfigDriver {
  private readonly projectName = faker.word.noun().toLowerCase();
  private readonly proxyPath = faker.system.filePath();
  private readonly port = faker.number.int({ min: 4500, max: 5999 });
  private root = '';
  private resolvedPort?: number;
  private resolvedPath?: string;

  given = {
    angularProject: async ({
      originalTarget,
    }: {
      originalTarget: 'configured';
    }): Promise<void> => {
      this.root = await mkdtemp(join(tmpdir(), 'atlas-angular-config-'));

      await writeFile(
        join(this.root, 'angular.json'),
        JSON.stringify({
          projects: {
            [this.projectName]: {
              architect: {
                serve: { options: { proxyConfig: faker.system.filePath() } },
                'serve-original': {
                  options: {
                    proxyConfig:
                      originalTarget === 'configured'
                        ? this.proxyPath
                        : undefined,
                  },
                },
              },
            },
          },
        }),
      );
    },
    devServer: async (framework: 'angular' | 'react'): Promise<void> => {
      this.root = await mkdtemp(join(tmpdir(), 'atlas-dev-server-config-'));

      if (framework === 'react') {
        await writeFile(
          join(this.root, 'vite.config.ts'),
          `export default { server: { port: ${this.port} } };\n`,
        );

        return;
      }

      await writeFile(
        join(this.root, 'angular.json'),
        JSON.stringify({
          projects: {
            [this.projectName]: {
              architect: {
                'serve-original': { options: { port: this.port } },
              },
            },
          },
        }),
      );
    },
  };

  when = {
    resolveProxyPath: async (): Promise<void> => {
      this.resolvedPath = await readAngularProxyConfigPath(
        this.root,
        this.projectName,
      );
    },
    resolvePort: async (): Promise<void> => {
      this.resolvedPort = await readConfiguredDevServerPort(
        this.root,
        this.projectName,
      );
    },
  };

  get = {
    configuredProxyPath: (): string => this.proxyPath,
    configuredPort: (): number => this.port,
    resolvedPort: (): number | undefined => this.resolvedPort,
    resolvedProxyPath: (): string | undefined => this.resolvedPath,
  };
}

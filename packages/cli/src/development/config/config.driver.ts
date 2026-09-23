import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { writeFile } from 'node:fs/promises';
import {
  readAngularProxyConfigPath,
  readConfiguredDevServerPort,
} from './config.js';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';

export class DevelopmentConfigDriver {
  private readonly temporaryDirectory = new TemporaryDirectory();
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
    }) => {
      this.root = await this.temporaryDirectory.create('atlas-angular-config-');

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
    devServer: async (framework: 'angular' | 'react') => {
      this.root = await this.temporaryDirectory.create(
        'atlas-dev-server-config-',
      );

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
    resolveProxyPath: async () => {
      this.resolvedPath = await readAngularProxyConfigPath(
        this.root,
        this.projectName,
      );
    },
    resolvePort: async () => {
      this.resolvedPort = await readConfiguredDevServerPort(
        this.root,
        this.projectName,
      );
    },
  };

  get = {
    configuredProxyPath: () => this.proxyPath,
    configuredPort: () => this.port,
    resolvedPort: () => this.resolvedPort,
    resolvedProxyPath: () => this.resolvedPath,
  };
}

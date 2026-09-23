import { faker } from '@faker-js/faker';
import { TemporaryDirectory } from '../temporary-directory.testkit.js';
import type { LocalNativeProxy } from '../../src/development/types.js';
import { loadAngularHostProxy } from '../../src/development/proxy-config/proxy-config.js';

export class ProxyConfigDriver {
  private readonly directory = new TemporaryDirectory();
  private readonly origin = faker.internet.url({ appendSlash: false });
  private configPath: string | undefined = 'proxy.conf.json';
  private proxy?: LocalNativeProxy;

  readonly given = {
    project: async () => {
      await this.directory.create('atlas-proxy-config-');
      await this.directory.writeJson('package.json', { name: 'host' });

      return this;
    },
    configPath: (configPath: string | undefined) => {
      this.configPath = configPath;

      return this;
    },
    angularBuildRoutes: async (routes: Record<string, unknown> | undefined) => {
      await this.directory.writeJson(
        'node_modules/@angular/build/package.json',
        {
          name: '@angular/build',
          exports: { './private': './private.cjs' },
        },
      );
      await this.directory.writeFile(
        'node_modules/@angular/build/private.cjs',
        `module.exports = { loadProxyConfiguration: async (root, configPath) => { process.env.ATLAS_TEST_PROXY_CALL = JSON.stringify({ root, configPath }); return ${JSON.stringify(routes)}; } };`,
      );

      return this;
    },
  };

  readonly when = {
    loaded: async () => {
      this.proxy = await loadAngularHostProxy(
        this.directory.root,
        this.configPath,
        this.origin,
      );
    },
  };

  readonly get = {
    proxy: () => this.proxy,
    origin: () => this.origin,
    projectRoot: () => this.directory.root,
    loadProxyConfigurationCall: () =>
      JSON.parse(process.env.ATLAS_TEST_PROXY_CALL ?? 'null'),
  };
}

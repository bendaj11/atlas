import { createServer, type Server } from 'node:http';
import { faker } from '@faker-js/faker';
import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import { closeServer } from '../http/http.js';
import type { LocalNativeProxy } from '../types.js';
import { startLocalBootstrapServer } from './bootstrap-server.js';

export class BootstrapServerDriver {
  private server?: Server;
  private upstream?: Server;
  private proxy?: LocalNativeProxy;
  private html?: string;
  private readonly runtime: AtlasHostRuntimeConfig = {
    schemaVersion: 'v1',
    hostId: faker.string.uuid(),
    artifactRegistryUrl: 'http://localhost:4400',
    environmentRegistryUrl: 'http://localhost:4400',
    environment: 'development',
    resourcesTimeoutMs: 1000,
    resourcesRetryCount: 1,
  };

  readonly given = {
    html: (html: string): this => {
      this.html = html;

      return this;
    },
    upstream: async (routes: Record<string, unknown>): Promise<this> => {
      this.upstream = createServer((request, response) => {
        response.writeHead(200, {
          'content-type': 'text/plain',
          'x-upstream': 'yes',
        });
        response.end(`upstream ${request.method} ${request.url}`);
      });
      await new Promise<void>((resolve) =>
        this.upstream!.listen(0, 'localhost', resolve),
      );
      const address = this.upstream.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      this.proxy = { origin: `http://localhost:${port}`, routes };

      return this;
    },
  };

  readonly when = {
    started: async (): Promise<void> => {
      this.server = await startLocalBootstrapServer({
        port: 0,
        runtime: this.runtime,
        ...(this.html !== undefined ? { html: this.html } : {}),
        ...(this.proxy ? { proxy: this.proxy } : {}),
      });
    },
    stopped: async (): Promise<void> => {
      this.server?.closeAllConnections();
      this.upstream?.closeAllConnections();
      if (this.server) await closeServer(this.server);
      if (this.upstream) await closeServer(this.upstream);
    },
  };

  readonly get = {
    response: (path: string, method = 'GET'): Promise<Response> => {
      const address = this.server!.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      return fetch(`http://localhost:${port}${path}`, { method });
    },
    runtime: (): AtlasHostRuntimeConfig => this.runtime,
  };
}

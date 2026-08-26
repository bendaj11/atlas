import { createServer, type Server } from 'node:http';
import { faker } from '@faker-js/faker';
import { startLocalBootstrapServer } from '../src/development/bootstrap-server/bootstrap-server.js';
import { closeServer } from '../src/development/http/http.js';

type BootstrapScenario = 'static' | 'proxy';

export class BootstrapServerDriver {
  private readonly hostId = faker.string.uuid();
  private readonly html = `<main id="atlas-host-root">${faker.lorem.sentence()}</main><script type="module" src="/atlas.loader.js"></script>`;
  private readonly upstreamBody = faker.lorem.sentence();
  private bootstrap?: Server;
  private upstream?: Server;
  private response?: Response;

  given = {
    server: async (scenario: BootstrapScenario): Promise<void> => {
      let proxy;

      if (scenario === 'proxy') {
        this.upstream = createServer((_request, response) =>
          response.end(this.upstreamBody),
        );

        await new Promise<void>((resolve) =>
          this.upstream?.listen(0, '127.0.0.1', resolve),
        );

        const address = this.upstream.address();

        if (!address || typeof address === 'string') {
          throw new Error('Expected upstream TCP address.');
        }

        proxy = {
          origin: `http://127.0.0.1:${address.port}`,
          routes: {
            '/api': { target: faker.internet.url() },
          },
        };
      }

      this.bootstrap = await startLocalBootstrapServer({
        html: this.html,
        port: 0,
        proxy,
        runtime: {
          hostId: this.hostId,
          environment: 'production',
          schemaVersion: 'v1',
          artifactRegistryUrl: faker.internet.url({ appendSlash: false }),
        },
      });
    },
  };

  when = {
    close: async (): Promise<void> => {
      if (this.bootstrap) await closeServer(this.bootstrap);
      if (this.upstream) await closeServer(this.upstream);
    },
    request: async (path: string): Promise<void> => {
      if (!this.bootstrap) throw new Error('Bootstrap setup is required.');

      const address = this.bootstrap.address();

      if (!address || typeof address === 'string') {
        throw new Error('Expected bootstrap TCP address.');
      }

      this.response = await fetch(`http://127.0.0.1:${address.port}${path}`);
    },
  };

  get = {
    body: async (): Promise<string> => this.response?.text() ?? '',
    expectedHostId: (): string => this.hostId,
    expectedHtml: (): string => this.html.replace('"></script>', ''),
    expectedUpstreamBody: (): string => this.upstreamBody,
    runtimeHostId: async (): Promise<string | undefined> =>
      ((await this.response?.json()) as { hostId?: string } | undefined)
        ?.hostId,
    status: (): number | undefined => this.response?.status,
  };
}

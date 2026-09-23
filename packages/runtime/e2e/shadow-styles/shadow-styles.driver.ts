import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

const workspace = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

type Scenario =
  'isolated' | 'shared' | 'missing' | 'integrity' | 'cors' | 'import-cors';

export class ShadowStylesBrowserDriver {
  private browser?: Browser;
  private server?: Server;
  private page?: Page;
  private scenario: Scenario = 'isolated';
  private error = '';

  readonly given = {
    scenario: (scenario: Scenario) => {
      this.scenario = scenario;
    },
  };

  readonly when = {
    open: async () => {
      const require = createRequire(
        resolve(workspace, 'packages/bootstrap/package.json'),
      );
      const { build } = require('esbuild') as {
        build(options: unknown): Promise<{ outputFiles: { text: string }[] }>;
      };
      const bundle = await build({
        entryPoints: [
          resolve(workspace, 'packages/runtime/src/stylesheets/stylesheets.ts'),
        ],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'browser',
      });
      const assets: Record<string, string> = {
        '/runtime.js': bundle.outputFiles[0]!.text,
        '/theme/library.css':
          '@import "./base.css" layer(base) supports(display: grid) screen; button { background: var(--package-background); background-image: url(./pixel.svg); }',
        '/theme/base.css':
          '@layer theme { :root { --package-background: black; } }',
        '/red.css':
          '@import "./theme/library.css" layer(library) supports(display: grid) screen; @media (min-width: 0px) { :root { --package-background: rgb(255, 0, 0); } }',
        '/blue.css':
          '@import "./theme/library.css" layer(library) supports(display: grid) screen; :root[data-theme="blue"] { --package-background: rgb(0, 0, 255); }',
      };
      this.server = createServer((request, response) => {
        const path = request.url ?? '/';
        if (
          !(this.scenario === 'cors' && path.endsWith('.css')) &&
          !(this.scenario === 'import-cors' && path === '/theme/library.css')
        )
          response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader(
          'Content-Type',
          path.endsWith('.css')
            ? 'text/css'
            : path.endsWith('.js')
              ? 'text/javascript'
              : 'text/html',
        );
        if (path === '/')
          response.end(
            '<!doctype html><html><head><style>:root { --package-background: rgb(0, 128, 0); } button { background: var(--package-background); }</style></head><body><button>Host</button></body></html>',
          );
        else if (assets[path]) response.end(assets[path]);
        else {
          response.statusCode = 404;
          response.end();
        }
      });
      await new Promise<void>((ready, reject) => {
        this.server!.once('error', reject);
        this.server!.listen(0, '127.0.0.1', ready);
      });
      const address = this.server.address();
      if (!address || typeof address === 'string')
        throw new Error('Missing test server port');
      const origin = `http://127.0.0.1:${address.port}`;
      this.browser = await chromium.launch();
      this.page = await this.browser.newPage();
      await this.page.goto(`http://localhost:${address.port}`);
      this.error = await this.page.evaluate(
        async ({ origin, scenario }) => {
          const { loadManifestStyles } = await import(`${origin}/runtime.js`);
          for (const color of ['red', 'blue']) {
            const host = document.createElement('section');
            host.dataset.theme = color;
            document.body.append(host);
            const target =
              scenario === 'shared'
                ? document.head
                : host.attachShadow({ mode: 'open' });
            const button = document.createElement('button');
            button.textContent = color;
            (scenario === 'shared' ? host : target).append(button);
            const href = `${origin}/${scenario === 'missing' ? 'missing' : color}.css`;
            try {
              await loadManifestStyles(
                {
                  id: color,
                  styles: [
                    {
                      href,
                      ...(scenario === 'integrity'
                        ? {
                            integrity:
                              'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
                          }
                        : {}),
                    },
                  ],
                },
                document,
                { target, policy: { allowedOrigins: new Set([origin]) } },
              );
            } catch (error) {
              return error instanceof Error
                ? `${error.message}${error.cause ? `: ${String(error.cause)}` : ''}`
                : String(error);
            }
          }
          return '';
        },
        { origin, scenario: this.scenario },
      );
    },
    cleanup: async () => {
      await this.browser?.close();
      await new Promise<void>((done, reject) => {
        if (!this.server?.listening) return done();
        this.server.close((error) => (error ? reject(error) : done()));
      });
    },
  };

  readonly get = {
    colors: async () => {
      if (!this.page) throw new Error('Open the page first');
      if (this.error) throw new Error(this.error);
      return Promise.all(
        ['Host', 'red', 'blue'].map((name) =>
          this.page!.getByRole('button', { name, exact: true }).evaluate(
            (element) => getComputedStyle(element).backgroundColor,
          ),
        ),
      );
    },
    assetPaths: async () => {
      if (!this.page) throw new Error('Open the page first');
      if (this.error) throw new Error(this.error);
      return Promise.all(
        ['red', 'blue'].map((name) =>
          this.page!.getByRole('button', { name, exact: true }).evaluate(
            (element) => {
              const image = getComputedStyle(element).backgroundImage;
              return new URL(image.slice(5, -2)).pathname;
            },
          ),
        ),
      );
    },
    error: () => this.error,
  };
}

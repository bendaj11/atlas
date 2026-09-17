import { createServer, type Server } from 'node:http';
import { jest } from '@jest/globals';
import type { ui as uiType } from '../../shared/index.js';

const info = jest.fn<typeof uiType.info>();

const uiModule = await import('../../shared/ui/ui.js');
jest.unstable_mockModule('../../shared/ui/ui.js', () => ({
  ...uiModule,
  ui: { info, warning: jest.fn(), success: jest.fn(), error: jest.fn() },
}));

const {
  closeServer,
  deleteJson,
  isAddressInUse,
  listenOnLocalHost,
  buildLocalOrigin,
  postJson,
  readJsonRequest,
  writeError,
  writeJson,
} = await import('./http.js');

export class HttpDriver {
  private server?: Server;
  private port = 0;
  private readonly received: { method?: string; body?: unknown }[] = [];
  private responder: (body: unknown) => { status: number; value: unknown } =
    () => ({ status: 200, value: { ok: true } });

  constructor() {
    info.mockReset();
  }

  readonly given = {
    responder: (
      responder: (body: unknown) => { status: number; value: unknown },
    ): this => {
      this.responder = responder;

      return this;
    },
    failingBodyParser: (): this => {
      this.responder = () => {
        throw new Error('handled elsewhere');
      };

      return this;
    },
  };

  readonly when = {
    serverStarted: async (label = 'Test server'): Promise<void> => {
      this.server = createServer((request, response) => {
        const body =
          request.method === 'DELETE'
            ? Promise.resolve(undefined)
            : readJsonRequest<unknown>(request);
        body
          .then((body) => {
            this.received.push({ method: request.method, body });
            const { status, value } = this.responder(body);
            writeJson(response, value, status);
          })
          .catch((error: unknown) => writeError(response, error));
      });
      await listenOnLocalHost(this.server, 0, label);
      const address = this.server.address();
      this.port = typeof address === 'object' && address ? address.port : 0;
    },
    serverClosed: async (): Promise<void> => {
      this.server!.closeAllConnections();
      await closeServer(this.server!);
    },
    posted: (path: string, value: unknown): Promise<void> =>
      postJson(`${buildLocalOrigin(this.port)}${path}`, value),
    deleted: (path: string): Promise<void> =>
      deleteJson(`${buildLocalOrigin(this.port)}${path}`),
    rawPosted: async (path: string, body: string): Promise<Response> =>
      fetch(`${buildLocalOrigin(this.port)}${path}`, { method: 'POST', body }),
  };

  readonly get = {
    received: () => this.received,
    infoMock: () => info,
    listening: (): boolean => this.server?.listening ?? false,
    localOrigin: (port: number): string => buildLocalOrigin(port),
    addressInUse: (error: unknown): boolean => isAddressInUse(error),
  };
}

import { createServer, type Server } from 'node:http';
import { connect, type Socket } from 'node:net';
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
  private client?: Socket;
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
    ) => {
      this.responder = responder;

      return this;
    },
    failingBodyParser: () => {
      this.responder = () => {
        throw new Error('handled elsewhere');
      };

      return this;
    },
  };

  readonly when = {
    serverStarted: async (label = 'Test server') => {
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
    serverClosed: async () => {
      await closeServer(this.server!);
      this.client?.destroy();
    },
    clientConnectedWithPendingRequest: async () => {
      const requestReceived = new Promise((resolve) =>
        this.server!.once('request', resolve),
      );
      const client = connect(this.port, 'localhost');
      this.client = client;
      await new Promise<void>((resolve) => client.once('connect', resolve));
      client.write(
        'POST /pending HTTP/1.1\r\nHost: localhost\r\nContent-Length: 10\r\n\r\n',
      );
      await requestReceived;
    },
    posted: (path: string, value: unknown) =>
      postJson(`${buildLocalOrigin(this.port)}${path}`, value),
    deleted: (path: string) =>
      deleteJson(`${buildLocalOrigin(this.port)}${path}`),
    rawPosted: async (path: string, body: string) =>
      fetch(`${buildLocalOrigin(this.port)}${path}`, { method: 'POST', body }),
  };

  readonly get = {
    received: () => this.received,
    infoMock: () => info,
    listening: () => this.server?.listening ?? false,
    localOrigin: (port: number) => buildLocalOrigin(port),
    addressInUse: (error: unknown) => isAddressInUse(error),
  };
}

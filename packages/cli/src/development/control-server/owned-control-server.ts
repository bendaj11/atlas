import { createServer } from 'node:http';
import { closeServer, LOCAL_HOST } from '../http/http.js';
import { createDevSessionStore } from '../session/session.js';
import type { DevControlServer, StartControlServerOptions } from '../types.js';
import { readActiveControlServerLeases } from './control-server-lease.js';
import { createControlRequestHandler } from './control-request-handler.js';

export async function startOwnedControlServer(
  options: StartControlServerOptions,
): Promise<DevControlServer> {
  const { port, document, overrideUrl } = options;
  const session = createDevSessionStore(document, overrideUrl);

  for (const lease of await readActiveControlServerLeases(port)) {
    session.register(lease.document);

    if (lease.ready) session.markDocumentReady(lease.document);
  }

  const server = createServer(
    createControlRequestHandler({ session, options }),
  );

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, LOCAL_HOST, () => {
      server.off('error', reject);

      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(
          new Error('Atlas dev control server did not receive a TCP port.'),
        );

        return;
      }

      resolve({
        port: address.port,
        async markReady() {
          session.markDocumentReady(document);
        },
        async reconcile() {
          session.markDocumentReady(document);
        },
        close() {
          return closeServer(server);
        },
      });
    });
  });
}

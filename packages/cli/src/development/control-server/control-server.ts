import { createServer, type ServerResponse } from 'node:http';
import { assertAtlasHostCatalog, type AtlasHostCatalog } from '@atlas/schema';
import { createDevSessionStore } from '../session/session.js';
import {
  closeServer,
  deleteJson,
  isAddressInUse,
  localOrigin,
  postJson,
  readJsonRequest,
  writeError,
  writeJson,
  LOCAL_HOST,
} from '../http/http.js';
import { CONTROL_RECONCILIATION_INTERVAL_MS } from '../constants.js';
import type {
  AtlasDevOverrideDocument,
  DevControlServer,
  DevSessionStore,
} from '../types.js';

export async function startControlServer(
  port: number,
  document: AtlasDevOverrideDocument,
  overrideUrl: string,
  registryUrl?: string,
): Promise<DevControlServer> {
  try {
    return await startOwnedControlServer(
      port,
      document,
      overrideUrl,
      registryUrl,
    );
  } catch (error) {
    if (!isAddressInUse(error)) throw error;
    return joinControlServer(port, document);
  }
}

function startOwnedControlServer(
  port: number,
  document: AtlasDevOverrideDocument,
  overrideUrl: string,
  registryUrl?: string,
): Promise<DevControlServer> {
  const session = createDevSessionStore(document, overrideUrl);
  const server = createServer(
    createControlRequestHandler(session, overrideUrl, registryUrl),
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

function createControlRequestHandler(
  session: DevSessionStore,
  overrideUrl: string,
  registryUrl?: string,
) {
  return (
    request: import('node:http').IncomingMessage,
    response: ServerResponse,
  ): void => {
    const requestUrl = new URL(request.url ?? '/', `http://${LOCAL_HOST}`);
    const pathname = requestUrl.pathname;
    const requestedHostId = requestUrl.searchParams.get('hostId') ?? undefined;
    setControlHeaders(response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
      });
      response.end();
      return;
    }
    if (
      request.method === 'POST' &&
      pathname === '/atlas.dev-session/overrides'
    ) {
      registerOverride(request, response, session, overrideUrl);
      return;
    }
    if (
      request.method === 'POST' &&
      pathname.startsWith('/atlas.dev-session/overrides/') &&
      pathname.endsWith('/ready')
    ) {
      const appId = pathSegment(
        pathname,
        '/atlas.dev-session/overrides/',
        '/ready',
      );
      if (appId) {
        session.markReady(appId, requestedHostId);
        writeJson(response, { status: 'ready' });
        return;
      }
    }
    if (
      request.method === 'DELETE' &&
      pathname.startsWith('/atlas.dev-session/overrides/')
    ) {
      const appId = pathSegment(pathname, '/atlas.dev-session/overrides/', '');
      if (appId) {
        session.unregister(appId, requestedHostId);
        writeJson(response, { status: 'removed' });
        return;
      }
    }
    if (
      request.method === 'POST' &&
      pathname.startsWith('/atlas.dev-session/hosts/') &&
      pathname.endsWith('/ready')
    ) {
      const hostId = pathSegment(
        pathname,
        '/atlas.dev-session/hosts/',
        '/ready',
      );
      if (hostId) {
        session.markHostReady(hostId);
        writeJson(response, { status: 'ready' });
        return;
      }
    }
    if (
      request.method === 'DELETE' &&
      pathname.startsWith('/atlas.dev-session/hosts/')
    ) {
      const hostId = pathSegment(pathname, '/atlas.dev-session/hosts/', '');
      if (hostId) {
        session.unregisterHost(hostId);
        writeJson(response, { status: 'removed' });
        return;
      }
    }
    if (
      request.method === 'GET' &&
      pathname === '/atlas.local-overrides.json'
    ) {
      respondWithSession(response, session.document(requestedHostId));
      return;
    }
    if (request.method === 'GET' && pathname === '/atlas.dev-session.json') {
      respondWithSession(response, session.devSession(requestedHostId));
      return;
    }
    if (
      request.method === 'GET' &&
      pathname.startsWith('/hosts/') &&
      pathname.endsWith('/catalog.json')
    ) {
      const hostId = pathSegment(pathname, '/hosts/', '/catalog.json');
      if (hostId) {
        void respondWithCatalog(response, session, hostId, registryUrl);
        return;
      }
    }
    if (
      request.method === 'GET' &&
      (pathname.startsWith('/hosts/') || pathname.startsWith('/apps/')) &&
      pathname.endsWith('/index.json')
    ) {
      void respondWithVersionIndex(response, pathname, registryUrl);
      return;
    }
    if (request.method === 'GET' && pathname === '/registry.json') {
      writeJson(response, session.registry());
      return;
    }
    if (request.method === 'GET' && pathname === '/health') {
      const ready = session.hasReadySession();
      writeJson(
        response,
        ready ? { status: 'ok' } : { status: 'starting' },
        ready ? 200 : 503,
      );
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found\n');
  };
}

async function respondWithCatalog(
  response: ServerResponse,
  session: DevSessionStore,
  hostId: string,
  registryUrl?: string,
): Promise<void> {
  const productionCatalog = registryUrl
    ? await readProductionCatalog(registryUrl, hostId).catch(() => undefined)
    : undefined;
  respondWithSession(response, session.catalog(hostId, productionCatalog));
}

async function respondWithVersionIndex(
  response: ServerResponse,
  pathname: string,
  registryUrl?: string,
): Promise<void> {
  if (!registryUrl) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found\n');
    return;
  }
  try {
    const upstream = await fetch(`${registryUrl}${pathname}`, {
      cache: 'no-store',
    });
    if (!upstream.ok) {
      response.writeHead(upstream.status, {
        'content-type': 'text/plain; charset=utf-8',
      });
      response.end('Version index unavailable\n');
      return;
    }
    writeJson(response, await upstream.json());
  } catch (error) {
    writeError(response, error);
  }
}

async function readProductionCatalog(
  registryUrl: string,
  hostId: string,
): Promise<AtlasHostCatalog> {
  const response = await fetch(
    `${registryUrl}/hosts/${encodeURIComponent(hostId)}/catalog.json`,
    { cache: 'no-store' },
  );
  if (!response.ok)
    throw new Error(`Production catalog returned ${response.status}.`);
  const catalog: unknown = await response.json();
  assertAtlasHostCatalog(catalog);
  if (catalog.hostId !== hostId)
    throw new Error(
      `Production catalog targets host ${catalog.hostId}, not ${hostId}.`,
    );
  return catalog;
}

function setControlHeaders(response: ServerResponse): void {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-private-network', 'true');
  response.setHeader('cache-control', 'no-store');
}

function registerOverride(
  request: import('node:http').IncomingMessage,
  response: ServerResponse,
  session: DevSessionStore,
  overrideUrl: string,
): void {
  readJsonRequest<AtlasDevOverrideDocument>(request)
    .then((document) => {
      session.register(document);
      writeJson(response, { status: 'registered', overrideUrl });
    })
    .catch((error: unknown) => writeError(response, error));
}

function respondWithSession(response: ServerResponse, value: unknown): void {
  if (value !== undefined) {
    writeJson(response, value);
    return;
  }
  response.writeHead(503, {
    'content-type': 'application/json; charset=utf-8',
    'retry-after': '1',
  });
  response.end('{"status":"starting"}\n');
}

function pathSegment(
  pathname: string,
  prefix: string,
  suffix: string,
): string | undefined {
  if (!pathname.startsWith(prefix) || (suffix && !pathname.endsWith(suffix)))
    return undefined;
  const end = suffix ? pathname.length - suffix.length : pathname.length;
  const segment = pathname.slice(prefix.length, end);
  return segment && !segment.includes('/')
    ? decodeURIComponent(segment)
    : undefined;
}

async function joinControlServer(
  port: number,
  document: AtlasDevOverrideDocument,
): Promise<DevControlServer> {
  const baseUrl = localOrigin(port);
  const appIds = document.overrides.map((override) => override.manifest.id);
  const hostQuery = `?hostId=${encodeURIComponent(document.hostId)}`;
  const hostPath = `${baseUrl}/atlas.dev-session/hosts/${encodeURIComponent(document.hostId)}`;
  const synchronize = async (): Promise<void> => {
    await postJson(`${baseUrl}/atlas.dev-session/overrides`, document);
    await Promise.all([
      ...appIds.map((appId) =>
        postJson(
          `${baseUrl}/atlas.dev-session/overrides/${encodeURIComponent(appId)}/ready${hostQuery}`,
          {},
        ),
      ),
      ...(document.hostOverride ? [postJson(`${hostPath}/ready`, {})] : []),
    ]);
  };
  const reconcile = async (): Promise<void> => {
    try {
      await synchronize();
    } catch {
      await synchronize();
    }
  };
  await reconcile();
  const reconciliation = setInterval(() => {
    void reconcile().catch(() => undefined);
  }, CONTROL_RECONCILIATION_INTERVAL_MS);
  reconciliation.unref();
  return {
    port,
    markReady: reconcile,
    reconcile,
    async close() {
      clearInterval(reconciliation);
      await Promise.all([
        ...appIds.map((appId) =>
          deleteJson(
            `${baseUrl}/atlas.dev-session/overrides/${encodeURIComponent(appId)}${hostQuery}`,
          ),
        ),
        ...(document.hostOverride ? [deleteJson(hostPath)] : []),
      ]);
    },
  };
}

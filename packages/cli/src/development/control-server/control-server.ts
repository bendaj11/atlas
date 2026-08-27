import { createServer, type ServerResponse } from 'node:http';
import type { AtlasHostCatalog } from '@atlas/schema';
import { loadHostDeployment } from '@atlas/runtime';
import { createDevSessionStore } from '../session/session.js';
import {
  readActiveControlServerLeases,
  removeControlServerLease,
  writeControlServerLease,
} from './control-server-lease.js';
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

interface StartControlServerOptions {
  port: number;
  document: AtlasDevOverrideDocument;
  overrideUrl: string;
  registryUrl?: string;
  environment?: string;
  loadPublishedCatalog?: typeof readPublishedCatalog;
}

export async function startControlServer(
  options: StartControlServerOptions,
): Promise<DevControlServer> {
  await writeControlServerLease({ ...options, ready: false });
  try {
    return withControlServerLease(
      await startOrJoinControlServer(options),
      options,
    );
  } catch (error) {
    await removeControlServerLease(options);
    throw error;
  }
}

async function startOrJoinControlServer(
  options: StartControlServerOptions,
): Promise<DevControlServer> {
  try {
    return await startOwnedControlServer(options);
  } catch (error) {
    if (!isAddressInUse(error)) throw error;
    return joinControlServer(options);
  }
}

async function startOwnedControlServer(
  options: StartControlServerOptions,
): Promise<DevControlServer> {
  const { port, document, overrideUrl } = options;
  const session = createDevSessionStore(document, overrideUrl);
  const leases = await readActiveControlServerLeases(port);
  for (const lease of leases) {
    session.register(lease.document);
    if (lease.ready) session.markDocumentReady(lease.document);
  }
  const server = createServer(createControlRequestHandler(session, options));
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

function withControlServerLease(
  control: DevControlServer,
  options: StartControlServerOptions,
): DevControlServer {
  let ready = false;
  const renew = () =>
    writeControlServerLease({
      port: control.port,
      document: options.document,
      ready,
    });
  const renewal = setInterval(
    () => void renew(),
    CONTROL_RECONCILIATION_INTERVAL_MS,
  );
  renewal.unref();
  return {
    port: control.port,
    async markReady() {
      ready = true;
      await renew();
      await control.markReady();
    },
    reconcile: () => control.reconcile(),
    async close() {
      clearInterval(renewal);
      await removeControlServerLease({
        port: control.port,
        document: options.document,
      });
      await control.close();
    },
  };
}

function createControlRequestHandler(
  session: DevSessionStore,
  options: StartControlServerOptions,
) {
  return (
    request: import('node:http').IncomingMessage,
    response: ServerResponse,
  ): void => {
    const requestUrl = new URL(request.url ?? '/', `http://${LOCAL_HOST}`);
    const pathname = requestUrl.pathname;
    const requestedHostId = requestUrl.searchParams.get('hostId') ?? undefined;
    const requestedPreviewUrl =
      requestUrl.searchParams.get('previewUrl') ?? undefined;
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
      registerOverride(request, response, session, options.overrideUrl);
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
      void respondWithDevelopmentSession(
        response,
        session,
        requestedHostId,
        requestedPreviewUrl,
        options,
      );
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

async function respondWithDevelopmentSession(
  response: ServerResponse,
  session: DevSessionStore,
  hostId: string | undefined,
  previewUrl: string | undefined,
  options: StartControlServerOptions,
): Promise<void> {
  if (previewUrl && !session.previewAllowed(hostId, previewUrl)) {
    writeJson(response, { error: 'Atlas preview URL is not registered.' }, 403);
    return;
  }
  respondWithSession(
    response,
    await developmentSession(session, hostId, options),
  );
}

async function developmentSession(
  session: DevSessionStore,
  hostId: string | undefined,
  options: StartControlServerOptions,
) {
  const publishedCatalog =
    options.registryUrl && hostId
      ? await (options.loadPublishedCatalog ?? readPublishedCatalog)(
          options.registryUrl,
          hostId,
          options.environment ?? 'production',
        ).catch(() => undefined)
      : undefined;
  return session.devSession(hostId, publishedCatalog);
}

async function readPublishedCatalog(
  registryUrl: string,
  hostId: string,
  environment: string,
): Promise<AtlasHostCatalog> {
  const root = registryUrl.endsWith('/') ? registryUrl : `${registryUrl}/`;
  return loadHostDeployment({
    manifestUrl: new URL(
      `environments/${encodeURIComponent(environment)}/hosts/${encodeURIComponent(hostId)}/manifest.json`,
      root,
    ).href,
    expectedHostId: hostId,
    expectedEnvironment: environment,
  });
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
  options: StartControlServerOptions,
): Promise<DevControlServer> {
  const { document, port } = options;
  const baseUrl = localOrigin(port);
  const appIds = document.overrides.map((override) => override.manifest.id);
  const hostQuery = `?hostId=${encodeURIComponent(document.hostId)}`;
  const hostPath = `${baseUrl}/atlas.dev-session/hosts/${encodeURIComponent(document.hostId)}`;
  let ownedControl: DevControlServer | undefined;
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
      try {
        ownedControl = await startOwnedControlServer(options);
        await ownedControl.markReady();
      } catch (error) {
        if (!isAddressInUse(error)) throw error;
        await synchronize();
      }
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
      if (ownedControl) {
        await ownedControl.close();
        return;
      }
      await removeJoinedOverrides();
    },
  };

  async function removeJoinedOverrides(): Promise<void> {
    try {
      await Promise.all([
        ...appIds.map((appId) =>
          deleteJson(
            `${baseUrl}/atlas.dev-session/overrides/${encodeURIComponent(appId)}${hostQuery}`,
          ),
        ),
        ...(document.hostOverride ? [deleteJson(hostPath)] : []),
      ]);
    } catch {
      // Control server may already have stopped. No override remains to remove.
    }
  }
}

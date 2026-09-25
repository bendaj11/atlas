import type { IncomingMessage, ServerResponse } from 'node:http';
import { ATLAS_PREVIEW_LAUNCHER_PATH } from '@atlas/schema';
import {
  LOCAL_HOST,
  readJsonRequest,
  writeError,
  writeJson,
} from '../http/http.js';
import type {
  AtlasDevOverrideDocument,
  DevSessionStore,
  StartControlServerOptions,
} from '../types.js';
import { previewLauncherPage } from './preview-launcher.js';
import {
  readPublishedCatalog,
  warnPublishedCatalogOnce,
} from './published-catalog.js';

const OVERRIDES_PATH = '/atlas.dev-session/overrides';
const HOSTS_PATH = '/atlas.dev-session/hosts';

type ControlRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => void;

interface ControlRequest {
  method: string | undefined;
  pathname: string;
  hostId: string | undefined;
  previewUrl: string | undefined;
}

export function createControlRequestHandler({
  session,
  options,
}: {
  session: DevSessionStore;
  options: StartControlServerOptions;
}): ControlRequestHandler {
  return (request, response) => {
    const control = parseControlRequest(request);

    setControlHeaders(response);

    if (control.method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
      });
      response.end();

      return;
    }

    if (control.method === 'POST' && control.pathname === OVERRIDES_PATH) {
      registerOverride({
        request,
        response,
        session,
        overrideUrl: options.overrideUrl,
      });

      return;
    }

    const appReady = extractPathSegmentBetween({
      pathname: control.pathname,
      prefix: `${OVERRIDES_PATH}/`,
      suffix: '/ready',
    });

    if (control.method === 'POST' && appReady) {
      session.markReady(appReady, control.hostId);
      writeJson(response, { status: 'ready' });

      return;
    }

    const appRemoved = extractPathSegmentBetween({
      pathname: control.pathname,
      prefix: `${OVERRIDES_PATH}/`,
    });

    if (control.method === 'DELETE' && appRemoved) {
      session.unregister(appRemoved, control.hostId);
      writeJson(response, { status: 'removed' });

      return;
    }

    const hostReady = extractPathSegmentBetween({
      pathname: control.pathname,
      prefix: `${HOSTS_PATH}/`,
      suffix: '/ready',
    });

    if (control.method === 'POST' && hostReady) {
      session.markHostReady(hostReady);
      writeJson(response, { status: 'ready' });

      return;
    }

    const hostRemoved = extractPathSegmentBetween({
      pathname: control.pathname,
      prefix: `${HOSTS_PATH}/`,
    });

    if (control.method === 'DELETE' && hostRemoved) {
      session.unregisterHost(hostRemoved);
      writeJson(response, { status: 'removed' });

      return;
    }

    if (
      control.method === 'GET' &&
      control.pathname === '/atlas.local-overrides.json'
    ) {
      respondWithSession({ response, value: session.document(control.hostId) });

      return;
    }

    if (
      control.method === 'GET' &&
      control.pathname === '/atlas.dev-session.json'
    ) {
      void respondWithDevelopmentSession({
        response,
        session,
        control,
        options,
      });

      return;
    }

    if (
      control.method === 'GET' &&
      control.pathname === ATLAS_PREVIEW_LAUNCHER_PATH
    ) {
      respondWithPreviewLauncher({ response, control });

      return;
    }

    if (control.method === 'GET' && control.pathname === '/health') {
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

function parseControlRequest(request: IncomingMessage): ControlRequest {
  const url = new URL(request.url ?? '/', `http://${LOCAL_HOST}`);

  return {
    method: request.method,
    pathname: url.pathname,
    hostId: url.searchParams.get('hostId') ?? undefined,
    previewUrl: url.searchParams.get('previewUrl') ?? undefined,
  };
}

function setControlHeaders(response: ServerResponse): void {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-private-network', 'true');
  response.setHeader('cache-control', 'no-store');
}

function registerOverride({
  request,
  response,
  session,
  overrideUrl,
}: {
  request: IncomingMessage;
  response: ServerResponse;
  session: DevSessionStore;
  overrideUrl: string;
}): void {
  readJsonRequest<AtlasDevOverrideDocument>(request)
    .then((document) => {
      session.register(document);
      writeJson(response, { status: 'registered', overrideUrl });
    })
    .catch((error: unknown) => writeError(response, error));
}

async function respondWithDevelopmentSession({
  response,
  session,
  control,
  options,
}: {
  response: ServerResponse;
  session: DevSessionStore;
  control: ControlRequest;
  options: StartControlServerOptions;
}): Promise<void> {
  if (
    control.previewUrl &&
    !session.previewAllowed(control.hostId, control.previewUrl)
  ) {
    writeJson(response, { error: 'Atlas preview URL is not registered.' }, 403);

    return;
  }

  const publishedCatalog = await loadPublishedCatalog({
    hostId: control.hostId,
    options,
  });
  respondWithSession({
    response,
    value: session.devSession(control.hostId, publishedCatalog),
  });
}

async function loadPublishedCatalog({
  hostId,
  options,
}: {
  hostId: string | undefined;
  options: StartControlServerOptions;
}) {
  const { registryUrl, environment = 'production' } = options;

  if (!registryUrl || !hostId) return undefined;

  const load = options.loadPublishedCatalog ?? readPublishedCatalog;

  try {
    return await load({ registryUrl, hostId, environment });
  } catch (error) {
    warnPublishedCatalogOnce({ registryUrl, hostId, error });

    return undefined;
  }
}

function respondWithPreviewLauncher({
  response,
  control,
}: {
  response: ServerResponse;
  control: ControlRequest;
}): void {
  if (!isWebPageUrl(control.previewUrl)) {
    writeJson(response, { error: 'Atlas preview URL is invalid.' }, 400);

    return;
  }

  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(previewLauncherPage(control.previewUrl));
}

function respondWithSession({
  response,
  value,
}: {
  response: ServerResponse;
  value: unknown;
}): void {
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

function isWebPageUrl(value: string | undefined): value is string {
  if (!value) return false;

  try {
    const { protocol } = new URL(value);

    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function extractPathSegmentBetween({
  pathname,
  prefix,
  suffix = '',
}: {
  pathname: string;
  prefix: string;
  suffix?: string;
}): string | undefined {
  if (!pathname.startsWith(prefix) || (suffix && !pathname.endsWith(suffix)))
    return undefined;

  const end = suffix ? pathname.length - suffix.length : pathname.length;
  const segment = pathname.slice(prefix.length, end);

  return segment && !segment.includes('/')
    ? decodeURIComponent(segment)
    : undefined;
}

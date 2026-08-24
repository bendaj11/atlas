import {
  createAtlasBootstrapFiles,
  type AtlasBootstrapManifest,
} from '@atlas/bootstrap';
import {
  createServer,
  request as createHttpRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { connect } from 'node:net';
import type { Duplex } from 'node:stream';
import type { LocalBootstrapServerOptions } from '../types.js';
import { listenOnLocalHost, LOCAL_HOST } from '../http/http.js';

export async function startLocalBootstrapServer(
  options: LocalBootstrapServerOptions,
): Promise<Server> {
  const files = createBootstrapFileMap(options);
  const server = createServer(
    createBootstrapRequestHandler(files, options.proxy),
  );
  server.on('upgrade', (request, socket, head) => {
    if (!matchesNativeProxyRoute(request.url, options.proxy)) {
      socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
      return;
    }
    proxyNativeUpgrade(request, socket, head, options.proxy!.origin);
  });
  return await listenOnLocalHost(server, options.port, 'Atlas local bootstrap');
}

function createBootstrapFileMap(
  options: LocalBootstrapServerOptions,
): Map<string, string> {
  const bootstrap: AtlasBootstrapManifest = {
    schemaVersion: '2',
    hostId: options.runtime.hostId,
    registryUrl: options.runtime.registryUrl ?? 'http://localhost:4400',
    resourcesTimeoutMs: options.runtime.resourcesTimeoutMs ?? 15000,
    resourcesRetryCount: options.runtime.resourcesRetryCount ?? 3,
    ...(options.runtime.assetOrigins
      ? { assetOrigins: options.runtime.assetOrigins }
      : {}),
    developmentRuntime: options.runtime,
  };
  return new Map([
    ...createAtlasBootstrapFiles({
      ...(options.html !== undefined ? { html: options.html } : {}),
    }).map((file) => [`/${file.path}`, file.contents] as const),
    [
      '/atlas.bootstrap.json',
      `${JSON.stringify(bootstrap, null, 2)}\n`,
    ] as const,
  ]);
}

function createBootstrapRequestHandler(
  files: ReadonlyMap<string, string>,
  proxy: LocalBootstrapServerOptions['proxy'],
) {
  return (
    request: import('node:http').IncomingMessage,
    response: ServerResponse,
  ): void => {
    if (matchesNativeProxyRoute(request.url, proxy)) {
      proxyNativeRequest(request, response, proxy!.origin);
      return;
    }
    const path = new URL(request.url ?? '/', `http://${LOCAL_HOST}`).pathname;
    const method = request.method ?? 'GET';
    if (!isBootstrapMethod(method)) {
      response.writeHead(405, { allow: 'GET, HEAD' });
      response.end();
      return;
    }
    const exactContents = files.get(path);
    if (exactContents !== undefined) {
      writeBootstrapResponse(response, path, exactContents, method);
      return;
    }
    if (hasFileExtension(path)) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found\n');
      return;
    }
    writeBootstrapResponse(
      response,
      '/index.html',
      files.get('/index.html')!,
      method,
    );
  };
}

function matchesNativeProxyRoute(
  requestUrl: string | undefined,
  proxy: LocalBootstrapServerOptions['proxy'],
): boolean {
  if (!proxy || !requestUrl) return false;
  return Object.entries(proxy.routes).some(
    ([context, options]) =>
      Boolean(options) && matchesProxyContext(context, requestUrl),
  );
}

function matchesProxyContext(context: string, requestUrl: string): boolean {
  return context.startsWith('^')
    ? new RegExp(context).test(requestUrl)
    : requestUrl.startsWith(context);
}

function proxyNativeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  origin: string,
): void {
  const target = new URL(origin);
  const proxy = createHttpRequest(
    {
      hostname: target.hostname,
      port: target.port || undefined,
      method: request.method,
      path: request.url,
      headers: {
        ...request.headers,
        host: target.host,
      },
    },
    (upstream) => {
      response.writeHead(upstream.statusCode ?? 502, upstream.headers);
      upstream.pipe(response);
    },
  );
  proxy.on('error', () => {
    if (!response.headersSent)
      response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Proxy request failed\n');
  });
  request.pipe(proxy);
}

function proxyNativeUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  origin: string,
): void {
  const target = new URL(origin);
  const upstream = connect({
    host: target.hostname,
    port: Number(target.port || 80),
  });
  upstream.once('connect', () => {
    upstream.write(createUpgradeRequest(request, target));
    if (head.length > 0) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.once('error', () => socket.destroy());
}

function createUpgradeRequest(request: IncomingMessage, target: URL): string {
  const headers = [...request.rawHeaders];
  const hostIndex = headers.findIndex(
    (header) => header.toLowerCase() === 'host',
  );
  if (hostIndex >= 0) headers[hostIndex + 1] = target.host;
  else headers.push('Host', target.host);
  const serializedHeaders = headers
    .map((header, index) => (index % 2 === 0 ? `${header}:` : ` ${header}\r\n`))
    .join('');
  return `${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${serializedHeaders}\r\n`;
}

function isBootstrapMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD';
}

function hasFileExtension(path: string): boolean {
  return /\.[A-Za-z0-9]+$/.test(path);
}

function writeBootstrapResponse(
  response: ServerResponse,
  path: string,
  contents: string,
  method: string,
): void {
  const contentType = path.endsWith('.html')
    ? 'text/html; charset=utf-8'
    : path.endsWith('.json')
      ? 'application/json; charset=utf-8'
      : 'text/javascript; charset=utf-8';
  response.writeHead(200, {
    'content-type': contentType,
    'cache-control': path === '/atlas.loader.js' ? 'no-cache' : 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  });
  response.end(method === 'HEAD' ? undefined : contents);
}

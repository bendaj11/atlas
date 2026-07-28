import { createAtlasBootstrapFiles } from '@atlas/bootstrap';
import { createServer, type Server, type ServerResponse } from 'node:http';
import type { LocalBootstrapServerOptions } from './types.js';
import { listenOnLocalHost, LOCAL_HOST } from './http.js';

export async function startLocalBootstrapServer(
  options: LocalBootstrapServerOptions,
): Promise<Server> {
  const files = createBootstrapFileMap(options);
  const server = createServer(createBootstrapRequestHandler(files));
  return await listenOnLocalHost(server, options.port, 'Atlas local bootstrap');
}

function createBootstrapFileMap(
  options: LocalBootstrapServerOptions,
): Map<string, string> {
  return new Map(
    createAtlasBootstrapFiles({
      runtime: options.runtime,
      ...(options.html !== undefined ? { html: options.html } : {}),
    }).map((file) => [`/${file.path}`, file.contents]),
  );
}

function createBootstrapRequestHandler(files: ReadonlyMap<string, string>) {
  return (
    request: import('node:http').IncomingMessage,
    response: ServerResponse,
  ): void => {
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

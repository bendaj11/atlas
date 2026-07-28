import type { IncomingMessage } from 'node:http';
import type { Server, ServerResponse } from 'node:http';
import { ui } from '../cli/ui.js';

export const LOCAL_HOST = 'localhost';

export function localOrigin(port: number): string {
  return `http://${LOCAL_HOST}:${port}`;
}

export function listenOnLocalHost(
  server: Server,
  port: number,
  label: string,
): Promise<Server> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, LOCAL_HOST, () => {
      server.off('error', reject);
      const address = server.address();
      const actualPort =
        typeof address === 'object' && address ? address.port : port;
      ui.info(`${label} listening at ${localOrigin(actualPort)}.`);
      resolve(server);
    });
  });
}

export function closeServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export function readJsonRequest<T>(request: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.once('error', reject);
    request.once('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as T);
      } catch {
        reject(new Error('Invalid JSON request body.'));
      }
    });
  });
}

export function writeJson(
  response: ServerResponse,
  value: unknown,
  status = 200,
): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

export function writeError(response: ServerResponse, error: unknown): void {
  writeJson(
    response,
    {
      error:
        error instanceof Error
          ? error.message
          : 'Atlas dev control request failed.',
    },
    400,
  );
}

export async function postJson(url: string, value: unknown): Promise<void> {
  await fetchControl(url, { method: 'POST', body: JSON.stringify(value) });
}

export async function deleteJson(url: string): Promise<void> {
  await fetchControl(url, { method: 'DELETE' });
}

async function fetchControl(url: string, init: RequestInit): Promise<void> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  if (response.ok) return;
  throw new Error(
    `Atlas dev control server rejected ${url}: ${response.status} ${await response.text()}`,
  );
}

export function isAddressInUse(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'EADDRINUSE'
  );
}

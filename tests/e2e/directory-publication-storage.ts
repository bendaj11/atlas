import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';

const LOCK_PATH = '.atlas/deployment.lock';
type Bytes = Uint8Array;

export class DirectoryPublicationStorage {
  readonly root: string;

  constructor(root: string | undefined) {
    if (!root) throw new Error('ATLAS_E2E_STORAGE is required.');
    this.root = root;
  }

  async read(path: string): Promise<Bytes | undefined> {
    try {
      return new Uint8Array(await readFile(this.resolve(path)));
    } catch (error) {
      if (error?.code === 'ENOENT') return undefined;
      throw error;
    }
  }

  async readStream(path: string): Promise<AsyncIterable<Bytes> | undefined> {
    const bytes = await this.read(path);
    if (!bytes) return undefined;
    return (async function* () {
      yield bytes;
    })();
  }

  async inspect(path: string) {
    try {
      const info = await stat(this.resolve(path));
      return {
        ...metadata(path),
        size: info.size,
        versionToken: String(info.mtimeMs),
        lastModified: info.mtime.toISOString(),
      };
    } catch (error) {
      if (error?.code === 'ENOENT') return undefined;
      throw error;
    }
  }

  async list(prefix: string) {
    const root = this.resolve(prefix);
    try {
      return await listFiles(root, prefix);
    } catch (error) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
  }

  async create(
    path: string,
    body: Bytes | AsyncIterable<Bytes>,
  ): Promise<void> {
    const destination = this.resolve(path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, await collect(body), { flag: 'wx' });
  }

  async replace(
    path: string,
    body: Bytes | AsyncIterable<Bytes>,
    _metadata: unknown,
    condition: { createOnly?: boolean; versionToken?: string },
  ): Promise<void> {
    const destination = this.resolve(path);
    const current = await this.inspect(path);
    if (condition.createOnly && current)
      throw new Error('Conditional create conflict.');
    if (
      condition.versionToken &&
      current?.versionToken !== condition.versionToken
    )
      throw new Error('Conditional replace conflict.');
    const temporary = `${destination}.${randomUUID()}.atlas-next`;
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(temporary, await collect(body));
    await rename(temporary, destination);
  }

  async remove(path: string): Promise<void> {
    await rm(this.resolve(path), { force: true });
  }

  async acquireLock(owner: string) {
    const token = randomUUID();
    const path = this.resolve(LOCK_PATH);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify({ owner, token }), { flag: 'wx' });
    return {
      assertHeld: async () => {
        const lease = JSON.parse(await readFile(path, 'utf8'));
        if (lease.token !== token)
          throw new Error('E2E publication lease was lost.');
      },
      release: async () => {
        const lease = JSON.parse(await readFile(path, 'utf8'));
        if (lease.token === token) await rm(path, { force: true });
      },
    };
  }

  resolve(path: string): string {
    return join(this.root, ...path.split('/'));
  }
}

function metadata(path: string) {
  return {
    cacheControl: isMutable(path)
      ? 'no-cache'
      : 'public, max-age=31536000, immutable',
    contentType: contentType(path),
  };
}

function isMutable(path: string): boolean {
  return (
    path === 'registry.json' ||
    /^environments\/[^/]+\/hosts\/[^/]+\/manifest\.json$/u.test(path)
  );
}

async function collect(body: Bytes | AsyncIterable<Bytes>): Promise<Bytes> {
  if (body instanceof Uint8Array) return body;
  const chunks: Bytes[] = [];
  for await (const chunk of body) chunks.push(chunk);
  const result = new Uint8Array(
    chunks.reduce((size, chunk) => size + chunk.byteLength, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function listFiles(directory: string, prefix: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      const key = `${prefix}${prefix.endsWith('/') ? '' : '/'}${entry.name}`;
      if (entry.isDirectory()) return listFiles(path, key);
      const info = await stat(path);
      return [
        { path: key, size: info.size, lastModified: info.mtime.toISOString() },
      ];
    }),
  );
  return nested.flat();
}

function contentType(path: string): string {
  if (path === 'registry.json' || path.endsWith('/manifest.json'))
    return 'application/json';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.js') || path.endsWith('.mjs'))
    return 'text/javascript; charset=utf-8';
  if (path.endsWith('.json') || path.endsWith('.map'))
    return 'application/json; charset=utf-8';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.txt')) return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

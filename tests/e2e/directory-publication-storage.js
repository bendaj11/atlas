import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const LOCK_PATH = ".atlas/deployment.lock";

export class DirectoryPublicationStorage {
  constructor(root) {
    if (!root) throw new Error("ATLAS_E2E_STORAGE is required.");
    this.root = root;
  }

  async read(path) {
    try {
      return new Uint8Array(await readFile(this.resolve(path)));
    } catch (error) {
      if (error?.code === "ENOENT") return undefined;
      throw error;
    }
  }

  async inspect(path) {
    return await this.read(path) === undefined ? undefined : metadata(path);
  }

  async create(path, bytes) {
    const destination = this.resolve(path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bytes, { flag: "wx" });
  }

  async replace(path, bytes) {
    const destination = this.resolve(path);
    const temporary = `${destination}.${randomUUID()}.atlas-next`;
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(temporary, bytes);
    await rename(temporary, destination);
  }

  async remove(path) {
    await rm(this.resolve(path), { force: true });
  }

  async acquireLock(owner) {
    const token = randomUUID();
    const path = this.resolve(LOCK_PATH);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify({ owner, token }), { flag: "wx" });
    return {
      assertHeld: async () => {
        const lease = JSON.parse(await readFile(path, "utf8"));
        if (lease.token !== token) throw new Error("E2E publication lease was lost.");
      },
      release: async () => {
        const lease = JSON.parse(await readFile(path, "utf8"));
        if (lease.token === token) await rm(path, { force: true });
      }
    };
  }

  resolve(path) {
    return join(this.root, ...path.split("/"));
  }
}

function metadata(path) {
  return {
    cacheControl: isMutable(path) ? "no-cache" : "public, max-age=31536000, immutable",
    contentType: contentType(path)
  };
}

function isMutable(path) {
  return path === "registry.json" || path.endsWith("/catalog.json") || path.endsWith("/index.json");
}

function contentType(path) {
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

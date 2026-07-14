import { mkdir, mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AtlasPublicationStorage } from "../dist/publish.js";

export async function publicationFixture(baseRevision: string) {
  const root = await mkdtemp(join(tmpdir(), "atlas-publish-"));
  const source = join(root, "publication");
  const storage = join(root, "storage");
  const plan = `${source}.json`;
  const files = [
    { path: "hosts/customer-host/catalog.json", cache: "revalidate" },
    { path: "apps/orders/index.json", cache: "revalidate" },
    { path: "registry.json", cache: "revalidate" },
    { path: "apps/orders/1.0.0/build-1/entry.js", cache: "immutable" }
  ] as const;
  for (const file of files) {
    const target = join(source, file.path);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, file.cache === "immutable" ? "export {};\n" : `${JSON.stringify({ path: file.path, revision: "sha256:new" })}\n`);
  }
  await writeFile(plan, `${JSON.stringify({ schemaVersion: "1", baseRevision, registryRevision: "sha256:new", files })}\n`);
  return { plan, storage };
}

export class DirectoryPublicationStorage implements AtlasPublicationStorage {
  private readonly lockPath: string;

  constructor(private readonly root: string) {
    this.lockPath = join(root, ".atlas-deployment.lock");
  }

  async read(path: string): Promise<Uint8Array | undefined> {
    try { return await readFile(join(this.root, path)); }
    catch (error) { if (isMissingFile(error)) return undefined; throw error; }
  }

  async create(path: string, bytes: Uint8Array): Promise<void> {
    const target = join(this.root, path);
    await mkdir(join(target, ".."), { recursive: true });
    const handle = await open(target, "wx");
    try { await handle.writeFile(bytes); }
    finally { await handle.close(); }
  }

  async replace(path: string, bytes: Uint8Array): Promise<void> {
    const target = join(this.root, path);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, bytes);
  }

  async remove(path: string): Promise<void> {
    await rm(join(this.root, path), { force: true });
  }

  async acquireLock(owner: string): Promise<() => Promise<void>> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.lockPath, owner, { flag: "wx" });
    return async () => { await rm(this.lockPath, { force: true }); };
  }
}

export class FailingMutableStorage implements AtlasPublicationStorage {
  readonly files = new Map<string, Uint8Array>();
  private failed = false;

  constructor(private readonly failingPath: string) {}

  async read(path: string): Promise<Uint8Array | undefined> {
    return this.files.get(path);
  }

  async create(path: string, bytes: Uint8Array): Promise<void> {
    this.files.set(path, bytes);
  }

  async replace(path: string, bytes: Uint8Array): Promise<void> {
    if (path === this.failingPath && !this.failed) {
      this.failed = true;
      throw new Error(`simulated write failure: ${path}`);
    }
    this.files.set(path, bytes);
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }

  async acquireLock(): Promise<() => Promise<void>> {
    return async () => undefined;
  }

  seed(path: string, value: string): void {
    this.files.set(path, new TextEncoder().encode(value));
  }

  text(path: string): string | undefined {
    const bytes = this.files.get(path);
    return bytes ? new TextDecoder().decode(bytes) : undefined;
  }
}

export async function fileText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

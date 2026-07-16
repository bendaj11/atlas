import { mkdir, mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestManifest } from "../../testkit/dist/index.js";
import type { AtlasProjectBuilder, AtlasPublicationLease, AtlasPublicationObjectMetadata, AtlasPublicationStorage } from "../dist/publish.js";
import { publicationContentType } from "../dist/publication-metadata.js";

export async function publicationFixture() {
  const root = await mkdtemp(join(tmpdir(), "atlas-publish-"));
  const source = join(root, "build");
  const storage = join(root, "storage");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "entry.js"), "export {};\n");
  const manifest = createTestManifest({
    id: "orders",
    version: "1.0.0",
    buildId: "build-1",
    remoteEntryUrl: "https://cdn.example/apps/orders/1.0.0/build-1/entry.js"
  });
  const builds: AtlasProjectBuilder = {
    async build() {
      return {
        artifact: "app",
        manifest,
        project: { id: "orders", root, packageName: "orders", version: "1.0.0", outputPaths: [source] },
        sourceDirectory: source,
        files: ["entry.js"]
      };
    }
  };
  return { builds, storage };
}

export class DirectoryPublicationStorage implements AtlasPublicationStorage {
  private readonly lockPath: string;
  private readonly metadata = new Map<string, AtlasPublicationObjectMetadata>();

  constructor(private readonly root: string) {
    this.lockPath = join(root, ".atlas-deployment.lock");
  }

  async read(path: string): Promise<Uint8Array | undefined> {
    try { return await readFile(join(this.root, path)); }
    catch (error) { if (isMissingFile(error)) return undefined; throw error; }
  }

  async inspect(path: string): Promise<AtlasPublicationObjectMetadata | undefined> {
    if (!await this.read(path)) return undefined;
    return this.metadata.get(path) ?? { cacheControl: "no-cache", contentType: publicationContentType(path) };
  }

  async create(path: string, bytes: Uint8Array, metadata: AtlasPublicationObjectMetadata): Promise<void> {
    const target = join(this.root, path);
    await mkdir(join(target, ".."), { recursive: true });
    const handle = await open(target, "wx");
    try { await handle.writeFile(bytes); }
    finally { await handle.close(); }
    this.metadata.set(path, metadata);
  }

  async replace(path: string, bytes: Uint8Array, metadata: AtlasPublicationObjectMetadata): Promise<void> {
    const target = join(this.root, path);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, bytes);
    this.metadata.set(path, metadata);
  }

  async remove(path: string): Promise<void> {
    await rm(join(this.root, path), { force: true });
    this.metadata.delete(path);
  }

  async acquireLock(owner: string): Promise<AtlasPublicationLease> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.lockPath, owner, { flag: "wx" });
    return {
      assertHeld: async () => undefined,
      release: async () => { await rm(this.lockPath, { force: true }); }
    };
  }
}

export class FailingMutableStorage implements AtlasPublicationStorage {
  readonly files = new Map<string, Uint8Array>();
  readonly metadata = new Map<string, AtlasPublicationObjectMetadata>();
  private failed = false;

  constructor(private readonly failingPath: string) {}

  async read(path: string): Promise<Uint8Array | undefined> {
    return this.files.get(path);
  }

  async inspect(path: string): Promise<AtlasPublicationObjectMetadata | undefined> {
    if (!this.files.has(path)) return undefined;
    return this.metadata.get(path) ?? { cacheControl: "no-cache", contentType: publicationContentType(path) };
  }

  async create(path: string, bytes: Uint8Array, metadata: AtlasPublicationObjectMetadata): Promise<void> {
    this.files.set(path, bytes);
    this.metadata.set(path, metadata);
  }

  async replace(path: string, bytes: Uint8Array, metadata: AtlasPublicationObjectMetadata): Promise<void> {
    if (path === this.failingPath && !this.failed) {
      this.failed = true;
      throw new Error(`simulated write failure: ${path}`);
    }
    this.files.set(path, bytes);
    this.metadata.set(path, metadata);
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
    this.metadata.delete(path);
  }

  async acquireLock(): Promise<AtlasPublicationLease> {
    return { assertHeld: async () => undefined, release: async () => undefined };
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

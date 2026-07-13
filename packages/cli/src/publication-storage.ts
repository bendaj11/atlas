import { createHash, createHmac } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { CliArguments } from "./arguments.js";

export interface AtlasPublicationStorage {
  read(path: string): Promise<Uint8Array | undefined>;
  create(path: string, bytes: Uint8Array, cacheControl: string): Promise<void>;
  replace(path: string, bytes: Uint8Array, cacheControl: string): Promise<void>;
  remove(path: string): Promise<void>;
  acquireLock(owner: string): Promise<() => Promise<void>>;
}

export type AtlasPublicationStorageSource = AtlasPublicationStorage
  | (() => AtlasPublicationStorage | Promise<AtlasPublicationStorage>);

export async function createPublicationStorage(
  args: CliArguments,
  storage?: AtlasPublicationStorageSource
): Promise<AtlasPublicationStorage> {
  if (storage) return typeof storage === "function" ? storage() : storage;
  const storageDirectory = args.flag("storage-directory") ?? process.env.ATLAS_STORAGE_DIRECTORY;
  if (storageDirectory) return new FileSystemPublicationStorage(resolve(storageDirectory));
  return new S3PublicationStorage(s3OptionsFromEnvironment());
}

export class FileSystemPublicationStorage implements AtlasPublicationStorage {
  private readonly lockPath: string;

  constructor(private readonly root: string) {
    this.lockPath = join(root, ".atlas-deployment.lock");
  }

  async read(path: string): Promise<Uint8Array | undefined> {
    try { return await readFile(join(this.root, path)); }
    catch (error) { if (isNodeError(error) && error.code === "ENOENT") return undefined; throw error; }
  }

  async create(path: string, bytes: Uint8Array): Promise<void> {
    const target = join(this.root, path);
    await mkdir(dirname(target), { recursive: true });
    try {
      const handle = await open(target, "wx");
      try { await handle.writeFile(bytes); }
      finally { await handle.close(); }
    } catch (error) {
      if (isNodeError(error) && error.code === "EEXIST") throw new Error(`Immutable publication object already exists: ${path}`);
      throw error;
    }
  }

  async replace(path: string, bytes: Uint8Array): Promise<void> {
    const target = join(this.root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }

  async remove(path: string): Promise<void> {
    await rm(join(this.root, path), { force: true });
  }

  async acquireLock(owner: string): Promise<() => Promise<void>> {
    await mkdir(this.root, { recursive: true });
    try {
      const handle = await open(this.lockPath, "wx");
      await handle.writeFile(`${owner}\n`);
      await handle.close();
    } catch (error) {
      if (isNodeError(error) && error.code === "EEXIST") throw new Error(`Atlas deployment lock is already held at ${this.lockPath}.`);
      throw error;
    }
    return async () => { await rm(this.lockPath, { force: true }); };
  }
}

export interface S3Options {
  endpoint: string;
  bucket: string;
  prefix: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export class S3PublicationStorage implements AtlasPublicationStorage {
  constructor(private readonly options: S3Options) {}

  async read(path: string): Promise<Uint8Array | undefined> {
    const response = await this.request("GET", path);
    if (response.status === 404) return undefined;
    await assertS3Response(response, `read ${path}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async create(path: string, bytes: Uint8Array, cacheControl: string): Promise<void> {
    const response = await this.request("PUT", path, bytes, { "cache-control": cacheControl, "if-none-match": "*" });
    if (response.status === 409 || response.status === 412) throw new Error(`Immutable publication object already exists: ${path}`);
    await assertS3Response(response, `create ${path}`);
  }

  async replace(path: string, bytes: Uint8Array, cacheControl: string): Promise<void> {
    await assertS3Response(await this.request("PUT", path, bytes, { "cache-control": cacheControl }), `replace ${path}`);
  }

  async remove(path: string): Promise<void> {
    const response = await this.request("DELETE", path);
    if (response.status !== 404) await assertS3Response(response, `remove ${path}`);
  }

  async acquireLock(owner: string): Promise<() => Promise<void>> {
    const path = ".atlas-deployment.lock";
    const response = await this.request("PUT", path, new TextEncoder().encode(owner), { "if-none-match": "*", "cache-control": "no-store" });
    if (response.status === 409 || response.status === 412) throw new Error("Atlas deployment lock is already held in object storage.");
    await assertS3Response(response, "acquire deployment lock");
    return async () => { await assertS3Response(await this.request("DELETE", path), "release deployment lock"); };
  }

  private async request(
    method: string,
    path: string,
    body: Uint8Array = new Uint8Array(),
    extraHeaders: Record<string, string> = {}
  ): Promise<Response> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = amzDate.slice(0, 8);
    const objectPath = [this.options.bucket, this.options.prefix, path].filter(Boolean).map(encodePathSegment).join("/");
    const url = new URL(objectPath, ensureTrailingSlash(this.options.endpoint));
    const payloadHash = sha256Hex(body);
    const headers: Record<string, string> = {
      host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      ...(this.options.sessionToken ? { "x-amz-security-token": this.options.sessionToken } : {}),
      ...extraHeaders
    };
    const signedHeaderNames = Object.keys(headers).map((name) => name.toLowerCase()).sort();
    const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name]!.trim()}\n`).join("");
    const canonicalRequest = [method, url.pathname, "", canonicalHeaders, signedHeaderNames.join(";"), payloadHash].join("\n");
    const scope = `${date}/${this.options.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
    const signature = createHmac("sha256", signingKey(this.options.secretAccessKey, date, this.options.region)).update(stringToSign).digest("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.options.accessKeyId}/${scope}, SignedHeaders=${signedHeaderNames.join(";")}, Signature=${signature}`;
    return fetch(url, { method, headers, ...(method === "GET" || method === "HEAD" ? {} : { body: Buffer.from(body) }) });
  }
}

function s3OptionsFromEnvironment(): S3Options {
  return {
    endpoint: process.env.ATLAS_S3_ENDPOINT ?? "https://s3.amazonaws.com",
    bucket: requiredEnvironment("ATLAS_S3_BUCKET"),
    prefix: process.env.ATLAS_S3_PREFIX ?? "",
    region: process.env.AWS_REGION ?? "us-east-1",
    accessKeyId: requiredEnvironment("AWS_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnvironment("AWS_SECRET_ACCESS_KEY"),
    ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {})
  };
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for S3 publication.`);
  return value;
}

function signingKey(secret: string, date: string, region: string): Buffer {
  const dateKey = createHmac("sha256", `AWS4${secret}`).update(date).digest();
  const regionKey = createHmac("sha256", dateKey).update(region).digest();
  const serviceKey = createHmac("sha256", regionKey).update("s3").digest();
  return createHmac("sha256", serviceKey).update("aws4_request").digest();
}

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function encodePathSegment(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

async function assertS3Response(response: Response, operation: string): Promise<void> {
  if (!response.ok) throw new Error(`S3 could not ${operation}: ${response.status} ${await response.text()}`);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

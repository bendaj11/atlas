import { createHash, createHmac } from "node:crypto";

export interface AtlasPublicationStorage {
  read(path: string): Promise<Uint8Array | undefined>;
  create(path: string, bytes: Uint8Array, cacheControl: string): Promise<void>;
  replace(path: string, bytes: Uint8Array, cacheControl: string): Promise<void>;
  remove(path: string): Promise<void>;
  acquireLock(owner: string): Promise<() => Promise<void>>;
}

export type AtlasPublicationStorageSource = AtlasPublicationStorage
  | (() => AtlasPublicationStorage | Promise<AtlasPublicationStorage>);

export async function createPublicationStorage(storage?: AtlasPublicationStorageSource): Promise<AtlasPublicationStorage> {
  if (!storage) {
    throw new Error("Publication storage is required. Configure storage in atlas.publish.ts or pass AtlasPublishConfig to AtlasPublishService.");
  }
  const resolvedStorage = typeof storage === "function" ? await storage() : storage;
  if (!isPublicationStorage(resolvedStorage)) throw new Error("Publication storage must implement AtlasPublicationStorage.");
  return resolvedStorage;
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

export function isPublicationStorage(value: unknown): value is AtlasPublicationStorage {
  if (typeof value !== "object" || value === null) return false;
  const storage = value as Partial<AtlasPublicationStorage>;
  return typeof storage.read === "function"
    && typeof storage.create === "function"
    && typeof storage.replace === "function"
    && typeof storage.remove === "function"
    && typeof storage.acquireLock === "function";
}

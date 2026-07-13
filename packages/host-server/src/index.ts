import type { Server } from "node:http";
import express, { type Express } from "express";
import type { AtlasHostRuntimeConfig } from "@atlas/schema";
import { ATLAS_BROWSER_LOADER } from "./browser-loader.js";

const DEFAULT_PORT = 8080;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_COUNT = 3;

export interface AtlasHostServerRuntime extends AtlasHostRuntimeConfig {}

export interface AtlasHostServerOptions {
  runtime: AtlasHostServerRuntime;
  port?: number;
  assetOrigins?: string[];
  loadingHtml?: string;
  configureExpress?: (app: Express) => void;
  log?: Pick<Console, "info" | "error">;
}

export interface AtlasHostServer {
  app: Express;
  listen(): Promise<Server>;
}

export function createAtlasHostServer(options: AtlasHostServerOptions): AtlasHostServer {
  validateRuntime(options.runtime);
  const runtime = { ...options.runtime, ...(options.assetOrigins?.length ? { assetOrigins: options.assetOrigins } : {}) };
  const contentOrigins = [
    ...(runtime.assetOrigins ?? []),
    ...(runtime.externalRegistryUrls ?? []).map((value) => new URL(value).origin)
  ];
  const app = express();
  const log = options.log ?? console;
  const port = options.port ?? DEFAULT_PORT;
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("referrer-policy", "strict-origin-when-cross-origin");
    response.setHeader("content-security-policy", contentSecurityPolicy(contentOrigins, runtime.allowOverrides === true));
    log.info(`${request.method} ${request.path}`);
    next();
  });
  app.get("/health/live", (_request, response) => response.status(200).type("text/plain").send("ok\n"));
  app.get("/health/ready", (_request, response) => response.status(200).type("text/plain").send("ready\n"));
  app.get("/atlas.runtime.json", (_request, response) => response.set("cache-control", "no-cache").json(runtime));
  app.get("/atlas.loader.js", (_request, response) => response.set("cache-control", "public, max-age=300").type("text/javascript").send(ATLAS_BROWSER_LOADER));
  options.configureExpress?.(app);
  app.get("*path", (request, response) => {
    if (hasAssetExtension(request.path)) {
      response.status(404).type("text/plain").send("Not found\n");
      return;
    }
    response.set("cache-control", "no-cache").type("html").send(indexHtml(options.loadingHtml));
  });
  return {
    app,
    listen: () => new Promise((resolve, reject) => {
      const server = app.listen(port);
      server.once("error", reject);
      server.once("listening", () => {
        const address = server.address();
        const actualPort = typeof address === "object" && address ? address.port : port;
        log.info(`Atlas host server listening on port ${actualPort}.`);
        resolve(server);
      });
    })
  };
}

export function runtimeFromEnvironment(environment: NodeJS.ProcessEnv = process.env): AtlasHostServerRuntime {
  const hostId = requiredEnvironment(environment, "ATLAS_HOST_ID");
  const catalogUrl = requiredEnvironment(environment, "ATLAS_CATALOG_URL");
  return {
    schemaVersion: "1",
    hostId,
    catalogUrl,
    allowOverrides: environment.ATLAS_ALLOW_OVERRIDES === "true",
    resourcesTimeoutMs: positiveInteger(environment.ATLAS_RESOURCE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    resourcesRetryCount: nonNegativeInteger(environment.ATLAS_RESOURCE_RETRY_COUNT, DEFAULT_RETRY_COUNT),
    ...(environment.ATLAS_ASSET_ORIGINS ? { assetOrigins: parseOrigins(environment.ATLAS_ASSET_ORIGINS) } : {}),
    ...(environment.ATLAS_EXTERNAL_REGISTRY_URLS
      ? { externalRegistryUrls: parseRegistryUrls(environment.ATLAS_EXTERNAL_REGISTRY_URLS) }
      : {})
  };
}

function parseOrigins(value: string): string[] {
  return value.split(/[\s,]+/).filter(Boolean).map((origin) => new URL(origin).origin);
}

function parseRegistryUrls(value: string): string[] {
  return [...new Set(value.split(/[\s,]+/).filter(Boolean).map((entry) => {
    const url = new URL(entry);
    if (url.protocol !== "https:" && !isLoopbackUrl(url)) {
      throw new Error("ATLAS_EXTERNAL_REGISTRY_URLS must contain HTTPS URLs or loopback URLs for local development.");
    }
    return url.href.replace(/\/$/, "");
  }))];
}

function isLoopbackUrl(url: URL): boolean {
  return (url.protocol === "http:" || url.protocol === "https:")
    && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

export async function closeAtlasHostServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function validateRuntime(runtime: AtlasHostServerRuntime): void {
  if (!runtime.hostId.trim()) throw new Error("Atlas host server requires a non-empty hostId.");
  try { new URL(runtime.catalogUrl); }
  catch { throw new Error("Atlas host server requires an absolute ATLAS_CATALOG_URL."); }
}

function requiredEnvironment(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error("ATLAS_RESOURCE_TIMEOUT_MS must be a positive integer.");
  return parsed;
}

function nonNegativeInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error("ATLAS_RESOURCE_RETRY_COUNT must be a non-negative integer.");
  return parsed;
}

export function hasAssetExtension(path: string): boolean {
  return /\.[A-Za-z0-9]+$/.test(path);
}

function contentSecurityPolicy(assetOrigins: string[], allowOverrides: boolean): string {
  const developmentOrigins = allowOverrides ? ["http://localhost:*", "http://127.0.0.1:*"] : [];
  const origins = [...assetOrigins.filter(Boolean), ...developmentOrigins].join(" ");
  return `default-src 'self'; script-src 'self' 'unsafe-inline' blob: ${origins}; connect-src 'self' blob: ${origins}; style-src 'self' 'unsafe-inline' blob: ${origins}; img-src 'self' data: ${origins}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`;
}

export function indexHtml(loadingHtml = "Loading product…"): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Atlas</title>
  </head>
  <body>
    <div id="atlas-host-root">${loadingHtml}</div>
    <script type="module" src="/atlas.loader.js"></script>
  </body>
</html>`;
}

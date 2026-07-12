import { createHash } from "node:crypto";
import { createTestManifest } from "../../testkit/dist/index.js";

const remoteBytes = new TextEncoder().encode('{"name":"orders","exposes":[{"key":"./entry","outFileName":"entry.js"}]}');
export const remoteIntegrity = `sha256-${createHash("sha256").update(remoteBytes).digest("base64")}`;

export function deploymentManifest(overrides: Record<string, unknown> = {}) {
  return createTestManifest({
    id: "orders",
    remoteEntryUrl: "https://cdn.example/orders/1/build/remoteEntry.json",
    integrity: remoteIntegrity,
    ...overrides
  });
}

export function createDeploymentFetch(manifests: unknown[], options: { includeCors: boolean; assetCacheControl?: string } = { includeCors: true }): typeof fetch {
  const jsonHeaders = { "content-type": "application/json", "cache-control": "no-cache" };
  const crossOriginHeaders = {
    "content-type": "application/json",
    "cache-control": options.assetCacheControl ?? "public, max-age=31536000, immutable",
    ...(options.includeCors ? { "access-control-allow-origin": "https://host.example" } : {})
  };
  return async (input: URL | RequestInfo, _init?: RequestInit) => {
    const url = input.toString();
    if (url.endsWith("atlas.runtime.json")) return Response.json({ schemaVersion: "1", hostId: "host", catalogUrl: "https://cdn.example/hosts/host/catalog.json", allowAppOverrides: true, resourcesTimeoutMs: 15000, resourcesRetryCount: 3 }, { headers: jsonHeaders });
    if (url.endsWith("catalog.json")) return Response.json({ schemaVersion: "1", hostId: "host", generatedAt: "2026-01-01T00:00:00.000Z", manifests }, { headers: { ...jsonHeaders, ...(options.includeCors ? { "access-control-allow-origin": "https://host.example" } : {}) } });
    if (url.endsWith("remoteEntry.json")) return new Response(remoteBytes, { headers: crossOriginHeaders });
    return new Response("export {};", { headers: { ...crossOriginHeaders, "content-type": "text/javascript" } });
  };
}

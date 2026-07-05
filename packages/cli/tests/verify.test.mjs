import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createTestManifest } from "../../testkit/dist/index.js";
import { AtlasVerifyService } from "../dist/verify.js";

const remoteBytes = new TextEncoder().encode('{"name":"orders","exposes":[{"key":"./entry","outFileName":"entry.js"}]}');
const remoteIntegrity = `sha256-${createHash("sha256").update(remoteBytes).digest("base64")}`;

test("verify accepts a healthy cross-origin deployment", async () => {
  const manifest = deploymentManifest();
  const service = new AtlasVerifyService(createDeploymentFetch([manifest]));

  const report = await service.run({
    runtimeUrl: "https://host.example/atlas.runtime.json",
    hostOrigin: "https://host.example"
  });

  assert.equal(report.failures, 0);
  assert.equal(report.hostId, "shell");
});

test("verify rejects multiple selected versions of one MF", async () => {
  const first = deploymentManifest();
  const second = deploymentManifest({ version: "2.0.0", buildId: "second" });
  const service = new AtlasVerifyService(createDeploymentFetch([first, second]));

  const report = await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });

  assert.equal(report.checks.some((check) => check.status === "failure" && check.subject === "catalog versions"), true);
});

test("verify rejects an asset whose integrity does not match", async () => {
  const service = new AtlasVerifyService(createDeploymentFetch([
    deploymentManifest({ integrity: "sha256-invalid" })
  ]));

  const report = await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });

  assert.equal(report.checks.some((check) => check.status === "failure" && check.subject.endsWith("integrity")), true);
});

test("verify rejects unresolved exported components", async () => {
  const service = new AtlasVerifyService(createDeploymentFetch([
    deploymentManifest({ uses: ["catalog/missing"] })
  ]));

  const report = await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });

  assert.equal(report.checks.some((check) => check.status === "failure" && check.subject === "exported components"), true);
});

test("verify rejects missing cross-origin CORS headers", async () => {
  const service = new AtlasVerifyService(createDeploymentFetch([deploymentManifest()], { includeCors: false }));

  const report = await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });

  assert.equal(report.checks.some((check) => check.status === "failure" && check.subject.endsWith("CORS")), true);
});

test("verify rejects remote origins outside the host trust policy", async () => {
  const service = new AtlasVerifyService(createDeploymentFetch([
    deploymentManifest({ remoteEntryUrl: "https://untrusted.example/orders/remoteEntry.json" })
  ]));

  const report = await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });

  assert.equal(report.checks.some((check) => check.status === "failure" && check.subject.endsWith("origin")), true);
});

test("verify bounds concurrent network requests", async () => {
  const manifests = Array.from({ length: 12 }, (_, index) => deploymentManifest({
    id: `orders-${index}`,
    remoteEntryUrl: `https://cdn.example/orders-${index}/remoteEntry.json`
  }));
  let active = 0;
  let maximum = 0;
  const baseFetch = createDeploymentFetch(manifests);
  const service = new AtlasVerifyService(async (...args) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    try { return await baseFetch(...args); }
    finally { active -= 1; }
  }, 3);

  await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });
  assert.equal(maximum, 3);
});

test("verify aborts network requests after the configured timeout", async () => {
  let receivedSignal;
  const keepAlive = setTimeout(() => {}, 50);
  const service = new AtlasVerifyService((_input, init) => new Promise((_resolve, reject) => {
    receivedSignal = init.signal;
    init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
  }));

  let report;
  try {
    report = await service.run({
      runtimeUrl: "https://host.example/atlas.runtime.json",
      timeoutMs: 5
    });
  } finally {
    clearTimeout(keepAlive);
  }

  assert.equal(receivedSignal.aborted, true);
  assert.equal(report.checks.some((check) => check.status === "failure" && check.subject === "runtime configuration"), true);
});

test("verify rejects non-positive or non-finite network timeouts", async () => {
  const service = new AtlasVerifyService(createDeploymentFetch([]));

  await assert.rejects(
    service.run({ runtimeUrl: "https://host.example/atlas.runtime.json", timeoutMs: 0 }),
    /positive finite number/
  );
  await assert.rejects(
    service.run({ runtimeUrl: "https://host.example/atlas.runtime.json", timeoutMs: Number.POSITIVE_INFINITY }),
    /positive finite number/
  );
});

test("verify warns when immutable caching has max-age zero", async () => {
  const service = new AtlasVerifyService(createDeploymentFetch(
    [deploymentManifest()],
    { includeCors: true, assetCacheControl: "public, max-age=0, immutable" }
  ));

  const report = await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });

  assert.equal(report.checks.some((check) => check.status === "warning" && check.subject === "orders remote entry cache"), true);
});

function deploymentManifest(overrides = {}) {
  return createTestManifest({
    id: "orders",
    remoteEntryUrl: "https://cdn.example/orders/1/build/remoteEntry.json",
    integrity: remoteIntegrity,
    ...overrides
  });
}

function createDeploymentFetch(manifests, options = { includeCors: true }) {
  const jsonHeaders = { "content-type": "application/json", "cache-control": "no-cache" };
  const crossOriginHeaders = {
    "content-type": "application/json",
    "cache-control": options.assetCacheControl ?? "public, max-age=31536000, immutable",
    ...(options.includeCors ? { "access-control-allow-origin": "https://host.example" } : {})
  };
  return async (input) => {
    const url = input.toString();
    if (url.endsWith("atlas.runtime.json")) return Response.json({
      schemaVersion: "1",
      hostId: "shell",
      catalogUrl: "https://cdn.example/hosts/shell/catalog.json",
      allowedRemoteOrigins: ["https://cdn.example"],
      requireIntegrity: true
    }, { headers: jsonHeaders });
    if (url.endsWith("catalog.json")) return Response.json({
      schemaVersion: "1",
      hostId: "shell",
      generatedAt: "2026-01-01T00:00:00.000Z",
      manifests
    }, { headers: { ...jsonHeaders, ...(options.includeCors ? { "access-control-allow-origin": "https://host.example" } : {}) } });
    if (url.endsWith("remoteEntry.json")) return new Response(remoteBytes, { headers: crossOriginHeaders });
    return new Response("export {};", { headers: { ...crossOriginHeaders, "content-type": "text/javascript" } });
  };
}

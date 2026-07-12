import assert from "node:assert/strict";
import { test } from "@jest/globals";
import { AtlasVerifyService } from "../dist/verify.js";
import { createDeploymentFetch, deploymentManifest, remoteIntegrity } from "./verify.driver.js";

test("verify accepts a healthy cross-origin deployment", async () => {
  const manifest = deploymentManifest();
  const service = new AtlasVerifyService(createDeploymentFetch([manifest]));

  const report = await service.run({
    runtimeUrl: "https://host.example/atlas.runtime.json",
    hostOrigin: "https://host.example"
  });

  assert.equal(report.failures, 0);
  assert.equal(report.hostId, "host");
});

test("verify rejects multiple selected versions of one app", async () => {
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

test("verify rejects unresolved exported widgets", async () => {
  const service = new AtlasVerifyService(createDeploymentFetch([
    deploymentManifest({ uses: ["catalog/missing"] })
  ]));

  const report = await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });

  assert.equal(report.checks.some((check) => check.status === "failure" && check.subject === "exported widgets"), true);
});

test("verify explains duplicate route base paths for one host", async () => {
  const first = deploymentManifest({
    id: "orders",
    placements: [{ id: "orders-route", kind: "route", hostId: "host", route: { basePath: "/orders", title: "Orders" } }]
  });
  const second = deploymentManifest({
    id: "billing",
    placements: [{ id: "billing-route", kind: "route", hostId: "host", route: { basePath: "/orders/", title: "Billing" } }]
  });
  const service = new AtlasVerifyService(createDeploymentFetch([first, second]));

  const report = await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });
  const failure = report.checks.find((check) => check.status === "failure" && check.subject === "route ownership");
  if (!failure) throw new Error("Expected route ownership failure.");

  assert.match(failure.message, /Duplicate routes: hostId "host" basePath "\/orders" is declared by "orders" and "billing"/);
  assert.match(failure.message, /each hostId can use a basePath only once/);
});

test("verify rejects missing cross-origin CORS headers", async () => {
  const service = new AtlasVerifyService(createDeploymentFetch([deploymentManifest()], { includeCors: false }));

  const report = await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });

  assert.equal(report.checks.some((check) => check.status === "failure" && check.subject.endsWith("CORS")), true);
});

test("verify accepts asset origins selected by the catalog", async () => {
  const service = new AtlasVerifyService(createDeploymentFetch([
    deploymentManifest({ remoteEntryUrl: "https://assets.example/orders/remoteEntry.json" })
  ]));

  const report = await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });

  assert.equal(report.checks.some((check) => check.status === "failure"), false);
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
  let receivedSignal: AbortSignal | undefined;
  const keepAlive = setTimeout(() => {}, 50);
  const service = new AtlasVerifyService((_input, init) => new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) throw new Error("Verify request did not receive an abort signal.");
    receivedSignal = signal;
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
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

  if (!receivedSignal) throw new Error("Verify request signal was not captured.");
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

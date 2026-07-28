import { expect, test } from "@jest/globals";
import { AtlasVerifyService } from "../dist/verification/verify.service.js";
import { createDeploymentFetch, deploymentManifest } from "./verify.driver.js";

test("verify accepts a healthy cross-origin deployment", async () => {
  const manifest = deploymentManifest();
  const service = new AtlasVerifyService(createDeploymentFetch([manifest]));

  const report = await service.run({
    runtimeUrl: "https://host.example/atlas.runtime.json",
    hostOrigin: "https://host.example"
  });

  expect(report.failures).toBe(0);
  expect(report.hostId).toBe("host");
});

test("verify rejects multiple selected versions of one app", async () => {
  const first = deploymentManifest();
  const second = deploymentManifest({ version: "2.0.0", buildId: "second" });
  const service = new AtlasVerifyService(createDeploymentFetch([first, second]));

  const report = await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });

  expect(report.checks.some((check) => check.status === "failure" && check.subject === "catalog versions")).toBe(true);
});

test("verify rejects an asset whose integrity does not match", async () => {
  const service = new AtlasVerifyService(createDeploymentFetch([
    deploymentManifest({ integrity: "sha256-invalid" })
  ]));

  const report = await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });

  expect(report.checks.some((check) => check.status === "failure" && check.subject.endsWith("integrity"))).toBe(true);
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

  expect(failure.message).toMatch(/Duplicate routes: hostId "host" basePath "\/orders" is declared by "orders" and "billing"/);
  expect(failure.message).toMatch(/each hostId can use a basePath only once/);
});

test("verify rejects missing cross-origin CORS headers", async () => {
  const service = new AtlasVerifyService(createDeploymentFetch([deploymentManifest()], { includeCors: false }));

  const report = await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });

  expect(report.checks.some((check) => check.status === "failure" && check.subject.endsWith("CORS"))).toBe(true);
});

test("verify accepts asset origins selected by the catalog", async () => {
  const service = new AtlasVerifyService(createDeploymentFetch([
    deploymentManifest({ remoteEntryUrl: "https://assets.example/orders/remoteEntry.json" })
  ]));

  const report = await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });

  expect(report.checks.some((check) => check.status === "failure")).toBe(false);
});

test("verify checks every shared fallback bundle", async () => {
  const baseFetch = createDeploymentFetch([deploymentManifest()]);
  const service = new AtlasVerifyService(async (input, init) => {
    if (input.toString().endsWith("/shared/react.js")) {
      return new Response("missing", { status: 404, statusText: "Not Found" });
    }
    return baseFetch(input, init);
  });

  const report = await service.run({
    runtimeUrl: "https://host.example/atlas.runtime.json"
  });

  expect(report.checks).toContainEqual(expect.objectContaining({
    status: "failure",
    subject: "orders shared react"
  }));
});

test("verify rejects incomplete shared dependency metadata", async () => {
  const baseFetch = createDeploymentFetch([deploymentManifest()]);
  const invalidMetadata = JSON.stringify({
    name: "orders",
    exposes: [{ key: "./entry", outFileName: "entry.js" }],
    shared: [{ packageName: "react", outFileName: "shared/react.js" }]
  });
  const service = new AtlasVerifyService(async (input, init) => {
    if (
      input.toString().includes("/orders/") &&
      input.toString().endsWith("/remoteEntry.json")
    ) {
      return new Response(invalidMetadata, {
        headers: {
          "access-control-allow-origin": "https://host.example",
          "cache-control": "public, max-age=31536000, immutable",
          "content-type": "application/json"
        }
      });
    }
    return baseFetch(input, init);
  });

  const report = await service.run({
    runtimeUrl: "https://host.example/atlas.runtime.json"
  });

  expect(report.checks).toContainEqual(expect.objectContaining({
    status: "failure",
    subject: "orders federation metadata"
  }));
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
  expect(maximum).toBe(3);
});

test("verify keeps response body consumption inside the network limit", async () => {
  const manifests = Array.from({ length: 8 }, (_, index) => deploymentManifest({
    id: `orders-${index}`,
    remoteEntryUrl: `https://cdn.example/orders-${index}/remoteEntry.json`
  }));
  let activeBodies = 0;
  let maximumBodies = 0;
  const baseFetch = createDeploymentFetch(manifests);
  const service = new AtlasVerifyService(async (...args) => {
    const response = await baseFetch(...args);
    const readBody = response.arrayBuffer.bind(response);
    Object.defineProperty(response, "arrayBuffer", {
      value: async () => {
        activeBodies += 1;
        maximumBodies = Math.max(maximumBodies, activeBodies);
        await new Promise((resolve) => setTimeout(resolve, 5));
        try { return await readBody(); }
        finally { activeBodies -= 1; }
      }
    });
    return response;
  }, 2);

  await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });

  expect(maximumBodies).toBe(2);
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
  expect(receivedSignal.aborted).toBe(true);
  expect(report.checks.some((check) => check.status === "failure" && check.subject === "runtime configuration")).toBe(true);
});

test("verify rejects non-positive or non-finite network timeouts", async () => {
  const service = new AtlasVerifyService(createDeploymentFetch([]));

  await expect(service.run({ runtimeUrl: "https://host.example/atlas.runtime.json", timeoutMs: 0 })).rejects.toThrow(/positive finite number/);
  await expect(service.run({ runtimeUrl: "https://host.example/atlas.runtime.json", timeoutMs: Number.POSITIVE_INFINITY })).rejects.toThrow(/positive finite number/);
});

test("verify warns when immutable caching has max-age zero", async () => {
  const service = new AtlasVerifyService(createDeploymentFetch(
    [deploymentManifest()],
    { includeCors: true, assetCacheControl: "public, max-age=0, immutable" }
  ));

  const report = await service.run({ runtimeUrl: "https://host.example/atlas.runtime.json" });

  expect(report.checks.some((check) => check.status === "warning" && check.subject === "orders remote entry cache")).toBe(true);
});

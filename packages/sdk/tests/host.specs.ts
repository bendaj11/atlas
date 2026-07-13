import assert from "node:assert/strict";
import { test } from "@jest/globals";
import { HttpClient, connectAtlasWidgetResolver, createAtlasEventBus, createAtlasSdk } from "../dist/host.js";
import { createMemoryNavigation } from "../../testkit/dist/index.js";
import { createHostSdk } from "./host.driver.js";

test("event bus publishes across apps and supports unsubscribe", () => {
  const bus = createAtlasEventBus<{ "orders.updated": { orderId: string } }>();
  const received: Array<{ orderId: string }> = [];
  const unsubscribe = bus.subscribe("orders.updated", (payload) => received.push(payload));
  bus.publish("orders.updated", { orderId: "42" });
  unsubscribe();
  bus.publish("orders.updated", { orderId: "43" });
  assert.deepEqual(received, [{ orderId: "42" }]);
});

test("core SDK exposes typed hostData and httpClient without extensions", async () => {
  interface ProjectHostSdk {
    hostData: { projectId: string };
  }
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const httpClient: typeof fetch = async (url, options) => { calls.push([url, options]); return new Response(null, { status: 204 }); };
  const sdk = createAtlasSdk<ProjectHostSdk>({
    hostId: "host",
    navigation: createMemoryNavigation(),
    hostData: { hostId: "host", name: "Host", projectId: "project-42" },
    httpClient
  });
  assert.equal(sdk.hostData.hostId, "host");
  assert.equal(sdk.hostData.name, "Host");
  assert.equal(sdk.hostData.projectId, "project-42");
  await sdk.httpClient.get("/orders");
  await sdk.httpClient.post("/orders", "payload");
  await sdk.httpClient.request("PATCH", "/orders/42", { body: "patch" });
  assert.deepEqual(calls.map(([, options]) => options?.method), ["GET", "POST", "PATCH"]);
});

test("host SDK adapts fetch-compatible httpClient providers", async () => {
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const httpClient: typeof fetch = async (url, init) => {
    calls.push([url, init]);
    return new Response(null, { status: 204 });
  };
  const sdk = createAtlasSdk({
    hostId: "host",
    navigation: createMemoryNavigation(),
    httpClient
  });
  assert.equal((await sdk.httpClient.delete("/orders/42")).status, 204);
  assert.deepEqual(calls, [["/orders/42", { method: "DELETE" }]]);
});

test("host SDK uses HttpClient by default", () => {
  const sdk = createHostSdk();
  assert.ok(sdk.httpClient instanceof HttpClient);
});

test("host runtime connects getWidget after SDK construction", async () => {
  const sdk = createHostSdk();
  await assert.rejects(() => sdk.getWidget("widget-id"), /not ready/);
  connectAtlasWidgetResolver(sdk, async (id) => ({
    id,
    name: "Widget",
    async mount() { return { async unmount() {} }; }
  }));
  assert.equal((await sdk.getWidget("widget-id")).name, "Widget");
});

test("HttpClient wraps fetch with HTTP helpers", async () => {
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const httpClient = new HttpClient(async (url, init) => {
    calls.push([url, init]);
    return new Response(null, { status: 204 });
  });
  assert.equal((await httpClient.post("/orders", "payload")).status, 204);
  assert.deepEqual(calls, [["/orders", { body: "payload", method: "POST" }]]);
});

test("host properties cannot replace core SDK capabilities", () => {
  assert.throws(() => createAtlasSdk({
    hostId: "host",
    navigation: createMemoryNavigation(),
    events: "invalid"
  } as never), /conflicts with a core SDK capability/);
});

test("event bus once listener is removed after its first event", () => {
  const bus = createAtlasEventBus();
  let calls = 0;
  bus.once("session.expired", () => { calls += 1; });
  bus.publish("session.expired", undefined);
  bus.publish("session.expired", undefined);
  assert.equal(calls, 1);
});

test("host SDK exposes consumer-typed host extensions", async () => {
  interface CommerceHostSdk {
    hostData: { storeId: string };
    showToast(message: string): void;
    openOrder(orderId: string): Promise<boolean>;
  }
  const shown: string[] = [];
  const sdk = createAtlasSdk<CommerceHostSdk>({
    hostId: "host",
    navigation: createMemoryNavigation(),
    hostData: { name: "Host", storeId: "store-7" },
    showToast(message: string) { shown.push(message); },
    async openOrder(orderId: string) { return orderId === "42"; }
  });
  assert.equal(sdk.hostData.storeId, "store-7");
  sdk.showToast("Order ready");
  assert.equal(await sdk.openOrder("42"), true);
  assert.deepEqual(shown, ["Order ready"]);
});

import assert from "node:assert/strict";
import { test } from "@jest/globals";
import { HttpClient, createAtlasEventBus, createAtlasSdk } from "../dist/host.js";
import { createMemoryNavigation } from "../../testkit/dist/index.js";
import { createHostSdk } from "./host.driver.js";
import type { AtlasModalOpener, AtlasToastRequest } from "../dist/host-overlays.js";

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
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const httpClient: typeof fetch = async (url, options) => { calls.push([url, options]); return new Response(null, { status: 204 }); };
  const sdk = createAtlasSdk({
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

test("HttpClient wraps fetch with HTTP helpers", async () => {
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const httpClient = new HttpClient(async (url, init) => {
    calls.push([url, init]);
    return new Response(null, { status: 204 });
  });
  assert.equal((await httpClient.post("/orders", "payload")).status, 204);
  assert.deepEqual(calls, [["/orders", { body: "payload", method: "POST" }]]);
});

test("host extensions cannot replace core SDK capabilities", () => {
  assert.throws(() => createAtlasSdk({
    hostId: "host",
    navigation: createMemoryNavigation(),
    extensions: { navigation: "invalid" }
  }), /conflicts with a core SDK capability/);
});

test("event bus once listener is removed after its first event", () => {
  const bus = createAtlasEventBus();
  let calls = 0;
  bus.once("session.expired", () => { calls += 1; });
  bus.publish("session.expired", undefined);
  bus.publish("session.expired", undefined);
  assert.equal(calls, 1);
});

test("host SDK delegates modal components and popup content to host overlay providers", async () => {
  const opened: unknown[][] = [];
  const openModal: AtlasModalOpener = async (request) => { opened.push(["modal", request.component, request.props]); return JSON.parse('"confirmed"'); };
  const sdk = createAtlasSdk({
    hostId: "host",
    navigation: createMemoryNavigation(),
    openModal,
    openPopup(request) { opened.push(["popup", request.content]); return { id: "popup-1", close() {} }; }
  });
  assert.equal(await sdk.modal.open({ component: { frameworkNative: true }, props: { orderId: "42" } }), "confirmed");
  assert.equal(sdk.popup.open({ content: { widget: "details/entity-popup", props: { id: "42" } } }).id, "popup-1");
  assert.deepEqual(opened, [
    ["modal", { frameworkNative: true }, { orderId: "42" }],
    ["popup", { widget: "details/entity-popup", props: { id: "42" } }]
  ]);
});

test("host SDK delegates toast requests to showToast", () => {
  const shown: AtlasToastRequest[] = [];
  const sdk = createAtlasSdk({
    hostId: "host",
    navigation: createMemoryNavigation(),
    showToast(request) { shown.push(request); }
  });
  sdk.toast.open({ title: "Saving order", state: "loading", dismissible: true });
  assert.deepEqual(shown, [{ title: "Saving order", state: "loading", dismissible: true }]);
});

test("host SDK treats modal as no-op when no modal provider is configured", async () => {
  const sdk = createHostSdk();
  assert.equal(await sdk.modal.open({ component: "details" }), undefined);
});

import assert from "node:assert/strict";
import test from "node:test";
import { HttpClient, createAtlasEventBus, createAtlasSdk } from "../dist/host.js";
import { createMemoryNavigation } from "../../testkit/dist/index.js";

test("event bus publishes across MFs and supports unsubscribe", () => {
  const bus = createAtlasEventBus();
  const received = [];
  const unsubscribe = bus.subscribe("orders.updated", (payload) => received.push(payload));
  bus.publish("orders.updated", { orderId: "42" });
  unsubscribe();
  bus.publish("orders.updated", { orderId: "43" });
  assert.deepEqual(received, [{ orderId: "42" }]);
});

test("core SDK exposes typed hostData and httpClient without extensions", async () => {
  const httpClient = {
    async request(method, url, options) {
      return { method, url, body: options?.body };
    },
    async get(url, options) { return this.request("GET", url, options); },
    async post(url, body, options) { return this.request("POST", url, { ...options, body }); },
    async put(url, body, options) { return this.request("PUT", url, { ...options, body }); },
    async patch(url, body, options) { return this.request("PATCH", url, { ...options, body }); },
    async delete(url, options) { return this.request("DELETE", url, options); },
    async head(url, options) { return this.request("HEAD", url, options); },
    async options(url, options) { return this.request("OPTIONS", url, options); }
  };
  const sdk = createAtlasSdk({
    hostId: "shell",
    navigation: createMemoryNavigation(),
    hostData: { hostId: "shell", name: "Shell", projectId: "project-42" },
    httpClient
  });
  assert.equal(sdk.hostData.hostId, "shell");
  assert.equal(sdk.hostData.name, "Shell");
  assert.equal(sdk.hostData.projectId, "project-42");
  assert.deepEqual(await sdk.httpClient.get("/orders"), { method: "GET", url: "/orders", body: undefined });
  assert.deepEqual(await sdk.httpClient.post("/orders", "payload"), { method: "POST", url: "/orders", body: "payload" });
  assert.deepEqual(await sdk.httpClient.request("PATCH", "/orders/42", { body: "patch" }), { method: "PATCH", url: "/orders/42", body: "patch" });
});

test("host SDK adapts fetch-compatible httpClient providers", async () => {
  const calls = [];
  const httpClient = async (url, init) => {
    calls.push([url, init]);
    return { ok: true };
  };
  const sdk = createAtlasSdk({
    hostId: "shell",
    navigation: createMemoryNavigation(),
    httpClient
  });
  assert.deepEqual(await sdk.httpClient.delete("/orders/42"), { ok: true });
  assert.deepEqual(calls, [["/orders/42", { method: "DELETE" }]]);
});

test("host SDK uses HttpClient by default", () => {
  const sdk = createAtlasSdk({
    hostId: "shell",
    navigation: createMemoryNavigation()
  });
  assert.ok(sdk.httpClient instanceof HttpClient);
});

test("HttpClient wraps fetch with HTTP helpers", async () => {
  const calls = [];
  const httpClient = new HttpClient(async (url, init) => {
    calls.push([url, init]);
    return { ok: true };
  });
  assert.deepEqual(await httpClient.post("/orders", "payload"), { ok: true });
  assert.deepEqual(calls, [["/orders", { body: "payload", method: "POST" }]]);
});

test("host extensions cannot replace core SDK capabilities", () => {
  assert.throws(() => createAtlasSdk({
    hostId: "shell",
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

test("host SDK delegates native content and widget references to host overlay providers", async () => {
  const opened = [];
  const sdk = createAtlasSdk({
    hostId: "shell",
    navigation: createMemoryNavigation(),
    async openModal(request) { opened.push(["modal", request.content]); return "confirmed"; },
    openPopup(request) { opened.push(["popup", request.content]); return { id: "popup-1", close() {} }; }
  });
  assert.equal(await sdk.modal.open({ content: { frameworkNative: true } }), "confirmed");
  assert.equal(sdk.popup.open({ content: { widget: "details/entity-popup", props: { id: "42" } } }).id, "popup-1");
  assert.deepEqual(opened, [
    ["modal", { frameworkNative: true }],
    ["popup", { widget: "details/entity-popup", props: { id: "42" } }]
  ]);
});

test("host SDK delegates toast requests to showToast", () => {
  const shown = [];
  const sdk = createAtlasSdk({
    hostId: "shell",
    navigation: createMemoryNavigation(),
    showToast(request) { shown.push(request); }
  });
  sdk.toast.open({ title: "Saving order", state: "loading", dismissible: true });
  assert.deepEqual(shown, [{ title: "Saving order", state: "loading", dismissible: true }]);
});

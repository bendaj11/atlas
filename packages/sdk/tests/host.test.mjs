import assert from "node:assert/strict";
import test from "node:test";
import { createAtlasEventBus, createAtlasHostSdk, createAtlasSdk } from "../dist/host.js";
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

test("host extensions expose typed hostData and httpClient without wrapping the provider", async () => {
  const httpClient = async (url) => ({ url });
  const sdk = createAtlasSdk({
    hostId: "shell",
    navigation: createMemoryNavigation(),
    extensions: { hostData: { projectId: "project-42" }, httpClient }
  });
  assert.equal(sdk.hostData.projectId, "project-42");
  assert.deepEqual(await sdk.httpClient("/orders"), { url: "/orders" });
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
  const sdk = createAtlasHostSdk({
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

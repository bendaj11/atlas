import assert from "node:assert/strict";
import test from "node:test";
import { createAtlasOverlayController, isWidgetContent } from "../dist/overlay.js";

test("overlay controller mounts a modal widget with close controls and tears it down", async () => {
  const calls = [];
  const closedByRef = [];
  let close;
  const controller = createAtlasOverlayController({
    getWidgetLoader: () => ({
      list: () => [],
      async mount(widget, container, props) {
        calls.push(["mount", widget, container, props]);
        return { widget: {}, async unmount() { calls.push(["unmount"]); } };
      }
    }),
    providers: {
      async openModal(_request, controls, content) {
        close = controls.close;
        await content.mount({ outlet: true });
        return {
          id: "modal",
          closed: new Promise(() => undefined),
          close(result) { closedByRef.push(result); },
          dismiss() {}
        };
      }
    }
  });

  const resultPromise = controller.openModal({ component: { widget: "details/entity", props: { id: "42" } } });
  await new Promise((resolve) => setImmediate(resolve));
  close("done");
  const result = await resultPromise;

  assert.equal(result, "done");
  assert.equal(calls[0][0], "mount");
  assert.equal(calls[0][1], "details/entity");
  assert.deepEqual(calls[0][2], { outlet: true });
  assert.equal(calls[0][3].id, "42");
  assert.equal(typeof calls[0][3].atlasModal.close, "function");
  assert.deepEqual(closedByRef, ["done"]);
  assert.deepEqual(calls.slice(1), [["unmount"]]);
});

test("overlay controller queues modal requests FIFO", async () => {
  const opened = [];
  const refs = [];
  const controller = createAtlasOverlayController({
    getWidgetLoader: () => undefined,
    providers: {
      openModal(request) {
        opened.push(request.component);
        const ref = createManualModalRef(String(request.component));
        refs.push(ref);
        return ref;
      }
    }
  });

  const first = controller.openModal({ component: "first" });
  const second = controller.openModal({ component: "second" });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(opened, ["first"]);

  refs[0].resolve("one");
  assert.equal(await first, "one");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(opened, ["first", "second"]);

  refs[1].resolve("two");
  assert.equal(await second, "two");
});

test("overlay controller dismiss resolves undefined", async () => {
  let dismiss;
  const controller = createAtlasOverlayController({
    getWidgetLoader: () => undefined,
    providers: {
      openModal(_request, controls) {
        dismiss = controls.dismiss;
        return createManualModalRef("modal");
      }
    }
  });

  const result = controller.openModal({ component: "native" });
  await new Promise((resolve) => setImmediate(resolve));
  dismiss();
  assert.equal(await result, undefined);
});

test("overlay controller rejects incompatible modal providers and continues queue", async () => {
  const opened = [];
  const controller = createAtlasOverlayController({
    getWidgetLoader: () => undefined,
    providers: {
      openModal(request) {
        opened.push(request.component);
        if (request.component === "bad") throw new Error("Unsupported modal component");
        const ref = createManualModalRef("good");
        ref.resolve("ok");
        return ref;
      }
    }
  });

  await assert.rejects(() => controller.openModal({ component: "bad" }), /Unsupported modal component/);
  assert.equal(await controller.openModal({ component: "good" }), "ok");
  assert.deepEqual(opened, ["bad", "good"]);
});

test("popup widget cleanup is idempotent and native content remains opaque", async () => {
  let unmounts = 0;
  let nativeContent;
  const controller = createAtlasOverlayController({
    getWidgetLoader: () => ({ list: () => [], async mount() { return { widget: {}, async unmount() { unmounts += 1; } }; } }),
    providers: {
      openPopup(request, content) {
        nativeContent = request.content;
        if (content) void content.mount({});
        return { id: "popup", close() {} };
      }
    }
  });
  const ref = controller.openPopup({ content: { widget: "map/entity" } });
  await new Promise((resolve) => setImmediate(resolve));
  await ref.close();
  await ref.close();
  assert.equal(unmounts, 1);
  assert.deepEqual(nativeContent, { widget: "map/entity" });
  assert.equal(isWidgetContent({ widget: "map/entity" }), true);
  assert.equal(isWidgetContent({ component: "map/entity" }), false);
});

function createManualModalRef(id) {
  let resolve;
  const closed = new Promise((next) => {
    resolve = next;
  });
  return {
    id,
    closed,
    close: resolve,
    dismiss: () => resolve(undefined),
    resolve
  };
}

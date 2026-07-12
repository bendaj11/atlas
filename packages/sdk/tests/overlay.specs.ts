import assert from "node:assert/strict";
import { test } from "@jest/globals";
import { createAtlasOverlayController, isWidgetContent } from "../dist/overlay.js";
import type { AtlasModalControls, AtlasModalRequest } from "../dist/host-overlays.js";
import type { AtlasModalProvider } from "../dist/overlay-types.js";
import { createManualModalRef, createTestElement, createTestWidget, modalCloseFrom, type ManualModalRef } from "./overlay.driver.js";

const nextTurn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

test("overlay controller mounts a modal widget with close controls and tears it down", async () => {
  const outlet = createTestElement();
  const closedByRef: unknown[] = [];
  let mountedWidget = "";
  let mountedContainer: HTMLElement | undefined;
  let mountedProps: unknown;
  let unmounts = 0;
  const controller = createAtlasOverlayController({
    getWidgetLoader: () => ({
      list: () => [],
      async mount(widget, container, props) {
        mountedWidget = widget;
        mountedContainer = container;
        mountedProps = props;
        return { widget: createTestWidget(), async unmount() { unmounts += 1; } };
      }
    }),
    providers: {
      async openModal(_request, _controls, content) {
        if (!content) throw new Error("Expected widget modal content.");
        await content.mount(outlet);
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
  await nextTurn();
  modalCloseFrom(mountedProps)("done");
  const result = await resultPromise;

  assert.equal(result, "done");
  assert.equal(mountedWidget, "details/entity");
  assert.equal(mountedContainer, outlet);
  assert.equal(typeof mountedProps, "object");
  assert.deepEqual(closedByRef, ["done"]);
  assert.equal(unmounts, 1);
});

test("overlay controller queues modal requests FIFO", async () => {
  const opened: unknown[] = [];
  const refs: Array<ManualModalRef<unknown>> = [];
  const openModal: AtlasModalProvider = function openModal<TResult, TProps extends object>(request: AtlasModalRequest<TResult, TProps>) {
    opened.push(request.component);
    const ref = createManualModalRef<TResult>(String(request.component));
    refs.push(ref);
    return ref;
  };
  const controller = createAtlasOverlayController({ getWidgetLoader: () => undefined, providers: { openModal } });

  const first = controller.openModal({ component: "first" });
  const second = controller.openModal({ component: "second" });

  await nextTurn();
  assert.deepEqual(opened, ["first"]);
  refs[0]?.resolve("one");
  assert.equal(await first, "one");
  await nextTurn();
  assert.deepEqual(opened, ["first", "second"]);
  refs[1]?.resolve("two");
  assert.equal(await second, "two");
});

test("overlay controller dismiss resolves undefined", async () => {
  let dismiss: (() => void) | undefined;
  const controller = createAtlasOverlayController({
    getWidgetLoader: () => undefined,
    providers: {
      openModal<TResult, TProps extends object>(_request: AtlasModalRequest<TResult, TProps>, controls: AtlasModalControls<TResult>) {
        dismiss = controls.dismiss;
        return createManualModalRef<TResult>("modal");
      }
    }
  });

  const result = controller.openModal({ component: "native" });
  await nextTurn();
  if (!dismiss) throw new Error("Modal provider was not opened.");
  dismiss();
  assert.equal(await result, undefined);
});

test("overlay controller rejects incompatible modal providers and continues queue", async () => {
  const opened: unknown[] = [];
  const openModal: AtlasModalProvider = function openModal<TResult, TProps extends object>(request: AtlasModalRequest<TResult, TProps>) {
    opened.push(request.component);
    if (request.component === "bad") throw new Error("Unsupported modal component");
    const ref = createManualModalRef<TResult>("good");
    ref.resolve();
    return ref;
  };
  const controller = createAtlasOverlayController({ getWidgetLoader: () => undefined, providers: { openModal } });

  await assert.rejects(() => controller.openModal({ component: "bad" }), /Unsupported modal component/);
  assert.equal(await controller.openModal({ component: "good" }), undefined);
  assert.deepEqual(opened, ["bad", "good"]);
});

test("popup widget cleanup is idempotent and native content remains opaque", async () => {
  let unmounts = 0;
  let nativeContent: unknown;
  const controller = createAtlasOverlayController({
    getWidgetLoader: () => ({
      list: () => [],
      async mount() { return { widget: createTestWidget(), async unmount() { unmounts += 1; } }; }
    }),
    providers: {
      openPopup(request, content) {
        nativeContent = request.content;
        if (content) void content.mount(createTestElement());
        return { id: "popup", close() {} };
      }
    }
  });
  const ref = controller.openPopup({ content: { widget: "map/entity" } });
  await nextTurn();
  await ref.close();
  await ref.close();
  assert.equal(unmounts, 1);
  assert.deepEqual(nativeContent, { widget: "map/entity" });
  assert.equal(isWidgetContent({ widget: "map/entity" }), true);
  assert.equal(isWidgetContent({ component: "map/entity" }), false);
});

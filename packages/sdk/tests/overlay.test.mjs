import assert from "node:assert/strict";
import test from "node:test";
import { createAtlasOverlayController, isWidgetContent } from "../dist/overlay.js";

test("overlay controller mounts a widget and tears it down when a modal closes", async () => {
  const calls = [];
  const controller = createAtlasOverlayController({
    getWidgetLoader: () => ({
      list: () => [],
      async mount(widget, container, props) {
        calls.push(["mount", widget, container, props]);
        return { component: {}, async unmount() { calls.push(["unmount"]); } };
      }
    }),
    providers: {
      async openModal(_request, content) {
        await content.mount({ outlet: true });
        return "done";
      }
    }
  });

  const result = await controller.openModal({ content: { widget: "details/entity", props: { id: "42" } } });
  assert.equal(result, "done");
  assert.deepEqual(calls, [["mount", "details/entity", { outlet: true }, { id: "42" }], ["unmount"]]);
});

test("popup widget cleanup is idempotent and native content remains opaque", async () => {
  let unmounts = 0;
  let nativeContent;
  const controller = createAtlasOverlayController({
    getWidgetLoader: () => ({ list: () => [], async mount() { return { component: {}, async unmount() { unmounts += 1; } }; } }),
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

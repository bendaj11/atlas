import assert from "node:assert/strict";
import { test } from "@jest/globals";
import type { ApplicationRef, EnvironmentInjector } from "@angular/core";
import { createAngularAtlasSdk } from "../dist/angular-widget.js";
import { connectAtlasWidgetResolver, createAtlasSdk, type AtlasWidgetHandle } from "../dist/host.js";
import { createReactAtlasSdk } from "../dist/react-widget.js";
import { createMemoryNavigation } from "../../testkit/dist/index.js";

test("React SDK caches widget component identity", () => {
  const sdk = createTestSdk();
  const reactSdk = createReactAtlasSdk(sdk);
  const Loading = () => null;

  const first = reactSdk.getWidget<{ name: string }>("widget-id", { loadingComponent: Loading });
  const second = reactSdk.getWidget<{ name: string }>("widget-id", { loadingComponent: Loading });

  assert.equal(first, second);
});

test("Angular SDK mounts into container id and updates typed inputs", async () => {
  const sdk = createTestSdk();
  const mountedInputs: Array<object> = [];
  let unmounted = false;
  connectAtlasWidgetResolver(sdk, <TInputs extends object>(widgetId: string): AtlasWidgetHandle<TInputs> => ({
    id: widgetId,
    name: "Widget",
    async mount(_container, inputs) {
      mountedInputs.push(inputs);
      return {
        setInputs(nextInputs) { mountedInputs.push(nextInputs); },
        async unmount() { unmounted = true; }
      };
    }
  }));
  const container = Object.create(null) as HTMLElement;
  const restoreDocument = installTestDocument({ "widget-container": container });

  try {
    const angularSdk = createAngularAtlasSdk(
      sdk,
      Object.create(null) as ApplicationRef,
      Object.create(null) as EnvironmentInjector
    );
    const widget = angularSdk.getWidget<{ count: number }>("widget-id", {
      containerId: "widget-container",
      inputs: { count: 1 }
    });
    await widget.ready;
    widget.setInputs({ count: 2 });
    await widget.destroy();

    assert.deepEqual(mountedInputs, [{ count: 1 }, { count: 2 }]);
    assert.equal(unmounted, true);
  } finally {
    restoreDocument();
  }
});

test("Angular SDK rejects missing widget container", () => {
  const restoreDocument = installTestDocument({});
  try {
    const angularSdk = createAngularAtlasSdk(
      createTestSdk(),
      Object.create(null) as ApplicationRef,
      Object.create(null) as EnvironmentInjector
    );

    assert.throws(
      () => angularSdk.getWidget("widget-id", { containerId: "missing", inputs: {} }),
      /container "missing" was not found/
    );
  } finally {
    restoreDocument();
  }
});

function createTestSdk() {
  return createAtlasSdk({ hostId: "host", navigation: createMemoryNavigation() });
}

function installTestDocument(elements: Record<string, HTMLElement>): () => void {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { getElementById: (id: string) => elements[id] ?? null }
  });
  return () => {
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else Reflect.deleteProperty(globalThis, "document");
  };
}

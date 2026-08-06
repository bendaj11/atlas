import assert from "node:assert/strict";
import "@angular/compiler";
import { test } from "@jest/globals";
import { injectAtlasSdk, WidgetOutlet, type AtlasSdk as AngularAtlasSdk, type WidgetBinding } from "../dist/angular.js";
import { useAtlasSdk, type AtlasSdk as ReactAtlasSdk } from "../dist/react.js";
import { frameworkApis, readSdkPackage } from "./framework-api.driver.js";

const { angular, react } = frameworkApis;

interface CustomerHostSdk {
  showToast(message: string): void;
}

interface ProductEvents {
  "orders.updated": { orderId: string };
  "cart.cleared": undefined;
}

const readAngularSdk: () => AngularAtlasSdk<CustomerHostSdk, ProductEvents> = injectAtlasSdk<CustomerHostSdk, ProductEvents>;
const readReactSdk: () => ReactAtlasSdk<CustomerHostSdk, ProductEvents> = useAtlasSdk<CustomerHostSdk, ProductEvents>;

function verifyFrameworkEventTypes(angularSdk: AngularAtlasSdk<CustomerHostSdk, ProductEvents>, reactSdk: ReactAtlasSdk<CustomerHostSdk, ProductEvents>): void {
  angularSdk.events.emit("orders.updated", { orderId: "42" });
  angularSdk.events.emit("cart.cleared");
  reactSdk.events.addEventListener("orders.updated", ({ orderId }) => orderId.toUpperCase());

  // @ts-expect-error Unknown event names must be rejected.
  angularSdk.events.emit("orders.created", { orderId: "42" });
  // @ts-expect-error Payload must match the selected event name.
  reactSdk.events.emit("orders.updated", { id: "42" });
  // @ts-expect-error Payload-bearing events require a payload.
  reactSdk.events.emit("orders.updated");
  // @ts-expect-error Payloadless events reject payload values.
  angularSdk.events.emit("cart.cleared", {});
}

function verifyAngularWidgetTypes(sdk: AngularAtlasSdk): WidgetBinding<{ orderId: string }> {
  return sdk.getWidget<{ orderId: string }>("widget-id", {
    inputs: { orderId: "42" }
  });
}

void verifyFrameworkEventTypes;
void verifyAngularWidgetTypes;

test("framework subpaths share one Atlas API vocabulary", () => {
  const sharedApiNames: Array<"defineApp" | "defineExportedWidget" | "createHostNavigation"> = ["defineApp", "defineExportedWidget", "createHostNavigation"];
  for (const name of sharedApiNames) {
    assert.equal(typeof angular[name], "function", `Angular must export ${name}`);
    assert.equal(typeof react[name], "function", `React must export ${name}`);
  }

  assert.equal(typeof angular.injectAtlasSdk, "function");
  assert.equal(typeof WidgetOutlet, "function");
  assert.equal(typeof angular.provideAtlasSdk, "function");
  assert.equal(typeof react.useAtlasSdk, "function");
  assert.equal(typeof react.AtlasSdkProvider, "function");
  assert.equal(typeof readAngularSdk, "function");
  assert.equal(typeof readReactSdk, "function");

  for (const name of [...Object.keys(angular), ...Object.keys(react)]) {
    assert.doesNotMatch(name, /Angular|React|Vue/, `${name} repeats its framework subpath`);
  }
});

test("unsupported Vue adapter is not a public SDK subpath", async () => {
  const packageJson = await readSdkPackage();
  assert.notEqual(packageJson.exports["./federation"], undefined);
  assert.notEqual(packageJson.exports["./federation-config"], undefined);
  assert.equal(packageJson.exports["./vue"], undefined);
});

test("Vite integration accepts every installed version", async () => {
  const packageJson = await readSdkPackage();

  assert.deepEqual(
    {
      range: packageJson.peerDependencies.vite,
      optional: packageJson.peerDependenciesMeta.vite?.optional
    },
    { range: "*", optional: true }
  );
});

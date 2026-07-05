import assert from "node:assert/strict";
import test from "node:test";
import { connectRouter, createRouterOptions, defineMicrofrontend, createHostNavigation } from "../dist/react.js";
import { generateHostFiles, generateMicrofrontendFiles, generateWidgetFiles } from "../../generators/dist/index.js";

test("React generator emits React 19 Vite Native Federation projects", () => {
  const host = files(generateHostFiles({ name: "shell", framework: "react" }));
  const mf = files(generateMicrofrontendFiles({ name: "orders", framework: "react" }));
  assert.match(host.get("package.json"), /"react": "\^19\.2\.0"/);
  assert.match(host.get("src/main.tsx"), /startHost/);
  assert.match(host.get("src/main.tsx"), /createBrowserRouter/);
  assert.match(host.get("src/main.tsx"), /data-atlas-host-status/);
  assert.match(host.get("vite.config.ts"), /babel-plugin-react-compiler/);
  assert.match(host.get("vite.config.ts"), /target: "19"/);
  assert.match(host.get("index.html"), /"shimMode": true/);
  assert.match(host.get("public/atlas.runtime.json"), /"waitForMfReady": true/);
  assert.match(host.get("public/atlas.runtime.json"), /"retryAttempts": 2/);
  assert.match(mf.get("vite.config.ts"), /remoteEntry\.json/);
  assert.match(mf.get("vite.config.ts"), /babel-plugin-react-compiler/);
  assert.match(mf.get("vite.config.ts"), /components\/\$\{id\}/);
  assert.match(mf.get("src/entry.tsx"), /createMemoryRouter/);
  assert.match(mf.get("src/entry.tsx"), /createRoutedMicrofrontend/);
  assert.match(mf.get("src/entry.tsx"), /RouterProvider/);
  assert.match(mf.get("src/entry.tsx"), /createRoot/);
  assert.match(mf.get("src/entry.tsx"), /useAtlasSdk/);
});

test("React Router MF bridge synchronizes native and host navigation", async () => {
  const atlas = createMfContext("/catalog/products?tab=open");
  const listeners = new Set();
  const router = {
    state: { location: { pathname: "/products", search: "?tab=open", hash: "" }, historyAction: "POP" },
    navigate(to, options) {
      this.state.location = splitUrl(to);
      this.state.historyAction = options?.replace ? "REPLACE" : "PUSH";
      for (const listener of listeners) listener();
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
  assert.deepEqual(createRouterOptions(atlas.context), { initialEntries: ["/products?tab=open"] });
  const disconnect = connectRouter(router, atlas.context);
  router.navigate("/details/42");
  assert.equal(atlas.url(), "/catalog/details/42");
  atlas.hostNavigate("/catalog/settings?mode=compact");
  await Promise.resolve();
  assert.deepEqual(router.state.location, { pathname: "/settings", search: "?mode=compact", hash: "" });
  disconnect();
});

test("React generator targets selected supported majors with React Compiler", () => {
  const react17Host = files(generateHostFiles({ name: "oldest-host", framework: "react", frameworkVersion: "^17.0.2" }));
  const react17 = files(generateMicrofrontendFiles({ name: "oldest", framework: "react", frameworkVersion: "^17.0.2" }));
  const react17Widget = files(generateWidgetFiles({ name: "oldest-widget", framework: "react", frameworkVersion: "^17.0.2" }));
  const react18 = files(generateMicrofrontendFiles({ name: "legacy", framework: "react", frameworkVersion: "^18.3.0" }));
  const react19 = files(generateMicrofrontendFiles({ name: "current", framework: "react", frameworkVersion: "^19.2.0" }));
  assert.match(react17.get("package.json"), /"react-compiler-runtime": "1\.0\.0"/);
  assert.match(react17.get("package.json"), /"react-router-dom": "\^6\.30\.1"/);
  assert.doesNotMatch(react17.get("package.json"), /"react-router": "\^7/);
  assert.match(react17Host.get("src/main.tsx"), /unmountComponentAtNode/);
  assert.doesNotMatch(react17Host.get("src/main.tsx"), /react-dom\/client/);
  assert.match(react17.get("src/entry.tsx"), /function createRoot\(container: Element\)/);
  assert.doesNotMatch(react17.get("src/entry.tsx"), /react-dom\/client/);
  assert.match(react17Widget.get("src\/exported-components\/oldest-widget\/index.tsx"), /unmountComponentAtNode/);
  assert.match(react18.get("package.json"), /"react": "\^18\.3\.0"/);
  assert.match(react18.get("package.json"), /"react-compiler-runtime": "1\.0\.0"/);
  assert.match(react19.get("package.json"), /"babel-plugin-react-compiler": "1\.0\.0"/);
  assert.doesNotMatch(react19.get("package.json"), /"react-compiler-runtime"/);
  assert.doesNotMatch(react19.get("package.json"), /"latest"/);
  assert.match(react18.get("vite.config.ts"), /target: \"18\"/);
  assert.throws(() => generateHostFiles({ name: "future", framework: "react", frameworkVersion: "^20.0.0" }), /not verified/);
  assert.doesNotThrow(() => generateHostFiles({ name: "future", framework: "react", frameworkVersion: "^20.0.0", allowUnsupportedVersion: true }));
});

test("React generator rejects unsafe project, widget, and host IDs", () => {
  assert.throws(() => generateHostFiles({ name: "../shell", framework: "react" }), /Invalid generator name/);
  assert.throws(() => generateMicrofrontendFiles({ name: "Orders", framework: "react" }), /Invalid generator name/);
  assert.throws(() => generateWidgetFiles({ name: "summary/widget", framework: "react" }), /Invalid generator name/);
  assert.throws(() => generateMicrofrontendFiles({ name: "orders", framework: "react", hostId: "shell\"], placements: []" }), /Invalid generator hostId/);
});

test("React generator targets a supplied compatible host and keeps framework dependencies isolated", () => {
  const mf = files(generateMicrofrontendFiles({ name: "orders", framework: "react", hostId: "customer-shell" }));
  assert.match(mf.get("atlas.config.ts"), /hostCompatibility: \["customer-shell"\]/);
  assert.match(mf.get("atlas.config.ts"), /hostId: "customer-shell"/);
  assert.match(mf.get("vite.config.ts"), /shared: \[\]/);
  assert.doesNotMatch(mf.get("atlas.config.ts"), /hostId: "shell"/);
});

test("React widget generator creates a typed independently deployed widget", () => {
  const widget = files(generateWidgetFiles({ name: "entity-popup", framework: "react" }));
  assert.match(widget.get("src/exported-components/entity-popup/index.tsx"), /EntityPopupWidgetProps/);
  assert.match(widget.get("src/exported-components/entity-popup/index.tsx"), /defineExportedComponent/);
});

test("React Router adapter owns navigation and subscriptions", async () => {
  const subscribers = new Set();
  const calls = [];
  const router = {
    state: { location: { pathname: "/orders", search: "?tab=open", hash: "" } },
    navigate(to, options) { calls.push([to, options]); if (typeof to === "string") this.state.location.pathname = to; for (const listener of subscribers) listener(); },
    subscribe(listener) { subscribers.add(listener); return () => subscribers.delete(listener); }
  };
  const navigation = createHostNavigation(router, "https://host.example");
  const seen = [];
  const unsubscribe = navigation.subscribe((location) => seen.push(location.pathname));
  navigation.navigate("/orders/42");
  navigation.replace("/orders/43");
  navigation.back();
  unsubscribe();
  assert.deepEqual(calls.map(([to]) => to), ["/orders/42", "/orders/43", -1]);
  assert.equal(calls[1][1].replace, true);
  assert.deepEqual(seen, ["/orders", "/orders/42", "/orders/43", "/orders/43"]);
});

test("React microfrontend creates, renders, and unmounts one root", async () => {
  const calls = [];
  const entry = defineMicrofrontend({
    createRoot(container) { calls.push(["create", container]); return { render(element) { calls.push(["render", element]); }, unmount() { calls.push(["unmount"]); } }; },
    createElement(request) { return request.context.basePath; }
  });
  const mounted = await entry.mount({ container: {}, sdk: {}, hostSdk: {}, context: { basePath: "/orders" } });
  await mounted.unmount();
  assert.deepEqual(calls.map(([name]) => name), ["create", "render", "unmount"]);
});

function files(generated) {
  return new Map(generated.map((file) => [file.path, file.contents]));
}

function splitUrl(value) {
  const url = new URL(value, "https://host.example");
  return { pathname: url.pathname, search: url.search, hash: url.hash };
}

function createMfContext(initialUrl) {
  let current = initialUrl;
  const listeners = new Set();
  const notify = () => { for (const listener of listeners) listener(); };
  const inner = () => {
    const value = splitUrl(current);
    return { pathname: value.pathname.replace(/^\/catalog/, "") || "/", query: {}, hash: value.hash };
  };
  const navigation = {
    basePath: "/catalog",
    navigate(to) { current = `/catalog${to.startsWith("/") ? to : `/${to}`}`; notify(); },
    replace(to) { this.navigate(to); }, back() {}, createHref(to) { return to; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getCurrentLocation() { return splitUrl(current); }, toInnerPath(to) { return `/catalog${to}`; }
  };
  return {
    context: { navigation, route: { getCurrent: inner, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } } },
    url: () => current,
    hostNavigate(value) { current = value; notify(); }
  };
}

import test from "node:test";
import assert from "node:assert/strict";
import { createBrowserNavigation, createRouteContext, createScopedNavigation, scopePath } from "../dist/navigation.js";
import { createMemoryNavigation } from "../../testkit/dist/index.js";

test("scopePath keeps app navigation under base path", () => {
  assert.equal(scopePath("/catalog", "details/42"), "/catalog/details/42");
  assert.equal(scopePath("/catalog", "/details/42"), "/catalog/details/42");
  assert.equal(scopePath("/catalog", "/catalog/details/42"), "/catalog/details/42");
});

test("route context exposes scoped path, query, params, and updates", () => {
  const navigation = createMemoryNavigation("/catalog/orders/42?tab=open&tag=a&tag=b");
  let title;
  const route = createRouteContext("/catalog", navigation, { setTabTitle: (nextTitle) => { title = nextTitle; } });
  assert.deepEqual(route.getCurrent(), { pathname: "/orders/42", query: { tab: "open", tag: ["a", "b"] }, hash: "" });
  assert.deepEqual(route.match("orders/:id"), { id: "42" });
  route.setTabTitle("Order 42");
  assert.equal(title, "Order 42");
  const seen = [];
  const unsubscribe = route.subscribe((location) => seen.push(location.pathname));
  navigation.navigate("/catalog/settings");
  unsubscribe();
  assert.deepEqual(seen, ["/orders/42", "/settings"]);
});

test("scopePath rejects absolute external URLs", () => {
  assert.throws(() => scopePath("/catalog", "https://example.com"));
});

test("createScopedNavigation scopes navigate calls", () => {
  const navigation = createMemoryNavigation("/");
  const scoped = createScopedNavigation("/catalog", navigation);

  scoped.navigate("details/42");

  assert.equal(navigation.getCurrentLocation().pathname, "/catalog/details/42");
});

test("browser navigation reattaches popstate after all subscribers leave", () => {
  const browser = createFakeWindow();
  const navigation = createBrowserNavigation(browser.windowLike);

  const unsubscribe = navigation.subscribe(() => undefined);
  unsubscribe();
  const seen = [];
  navigation.subscribe((location) => seen.push(location.pathname));
  browser.setPathname("/returned");
  browser.dispatchPopstate();

  assert.deepEqual(seen, ["/", "/returned"]);
  assert.deepEqual(browser.listenerCounts(), { added: 2, removed: 1 });
});

test("browser navigation can subscribe again after explicit disposal", () => {
  const browser = createFakeWindow();
  const navigation = createBrowserNavigation(browser.windowLike);

  navigation.subscribe(() => undefined);
  navigation.dispose();
  const seen = [];
  navigation.subscribe((location) => seen.push(location.pathname));
  browser.setPathname("/after-dispose");
  browser.dispatchPopstate();

  assert.deepEqual(seen, ["/", "/after-dispose"]);
  assert.deepEqual(browser.listenerCounts(), { added: 2, removed: 1 });
});

function createFakeWindow() {
  let popstateListener;
  let added = 0;
  let removed = 0;
  const location = { pathname: "/", search: "", hash: "", href: "http://atlas.test/" };
  const windowLike = {
    location,
    history: {
      pushState() {},
      replaceState() {},
      back() {},
      go() {}
    },
    addEventListener(type, listener) {
      if (type !== "popstate") return;
      popstateListener = listener;
      added += 1;
    },
    removeEventListener(type, listener) {
      if (type !== "popstate" || popstateListener !== listener) return;
      popstateListener = undefined;
      removed += 1;
    }
  };

  return {
    windowLike,
    setPathname(pathname) {
      location.pathname = pathname;
      location.href = `http://atlas.test${pathname}`;
    },
    dispatchPopstate() {
      popstateListener?.({ type: "popstate" });
    },
    listenerCounts() {
      return { added, removed };
    }
  };
}

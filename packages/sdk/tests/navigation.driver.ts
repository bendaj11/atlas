import type { BrowserWindowLike } from "../src/browser-navigation.js";

export function createFakeWindow() {
  let popstateListener: (() => void) | undefined;
  let added = 0;
  let removed = 0;
  const location = { pathname: "/", search: "", hash: "", href: "http://atlas.test/" };
  const windowLike: BrowserWindowLike = {
    location,
    history: { pushState() {}, replaceState() {}, back() {}, go() {} },
    addEventListener(type: "popstate", listener: () => void) {
      if (type !== "popstate") return;
      popstateListener = listener;
      added += 1;
    },
    removeEventListener(type: "popstate", listener: () => void) {
      if (type !== "popstate" || popstateListener !== listener) return;
      popstateListener = undefined;
      removed += 1;
    }
  };

  return {
    windowLike,
    setPathname(pathname: string) {
      location.pathname = pathname;
      location.href = `http://atlas.test${pathname}`;
    },
    dispatchPopstate() { popstateListener?.(); },
    listenerCounts: () => ({ added, removed })
  };
}

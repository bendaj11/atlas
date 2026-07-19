import type { AtlasGeneratedFile } from "../../generators/dist/index.js";
import { createTestManifest } from "../../testkit/dist/index.js";
import type { AtlasAppContext } from "../dist/lifecycle.js";
import type { AtlasNavigationListener, AtlasScopedNavigation } from "../dist/navigation-types.js";

export function files(generated: AtlasGeneratedFile[]) {
  const generatedFiles = new Map(generated.map((file) => [file.path, file.contents]));
  return {
    has(path: string): boolean { return generatedFiles.has(path); },
    get(path: string): string {
      const contents = generatedFiles.get(path);
      if (contents === undefined) throw new Error(`Generated file "${path}" was not found.`);
      return contents;
    }
  };
}

export function splitUrl(value: string) {
  const url = new URL(value, "https://host.example");
  return { pathname: url.pathname, search: url.search, hash: url.hash };
}

export function createAppContext(initialUrl: string) {
  let current = initialUrl;
  const listeners = new Set<AtlasNavigationListener>();
  const inner = () => {
    const value = splitUrl(current);
    return { pathname: value.pathname.replace(/^\/catalog/, "") || "/", query: {}, hash: value.hash };
  };
  const routeListeners = new Set<(location: ReturnType<typeof inner>) => void>();
  const notify = () => {
    const location = splitUrl(current);
    for (const listener of listeners) listener(location);
    for (const listener of routeListeners) listener(inner());
  };
  const navigation: AtlasScopedNavigation = {
    basePath: "/catalog",
    navigate(to: string) { current = `/catalog${to.startsWith("/") ? to : `/${to}`}`; notify(); },
    replace(to: string) { this.navigate(to); }, back() {}, createHref(to: string) { return to; },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getCurrentLocation() { return splitUrl(current); }, toInnerPath(to: string) { return `/catalog${to}`; }
  };
  const context: AtlasAppContext = {
    manifest: createTestManifest(), hostId: "host", basePath: "/catalog", navigation,
    route: { basePath: "/catalog", getCurrent: inner, match: () => undefined, setTabTitle() {}, subscribe(listener) { routeListeners.add(listener); return () => { routeListeners.delete(listener); }; } },
    loading: { show() {}, hide() {}, waitUntilReady: () => () => undefined }
  };
  return {
    context,
    url: () => current,
    hostNavigate(value: string) { current = value; notify(); }
  };
}

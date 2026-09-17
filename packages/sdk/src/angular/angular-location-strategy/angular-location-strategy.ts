import type { AtlasAppContext } from '../../lifecycle.js';
import { readAppInnerUrl } from '../../navigation/app-inner-url/app-inner-url.js';
import { goThroughHistory } from '../../navigation/navigation-paths/index.js';
import type {
  LocationStrategyAdapter,
  PopStateListener,
} from '../angular-types/angular-types.js';

/** Creates the LocationStrategy used by an Angular Router mounted inside an Atlas app. */
export function createLocationStrategy(
  context: AtlasAppContext,
): LocationStrategyAdapter {
  const listeners = new Set<PopStateListener>();
  let ignoredUrl: string | undefined;

  const stop = context.route.subscribe(() => {
    const current = readAppInnerUrl(context);

    if (ignoredUrl === current) {
      ignoredUrl = undefined;

      return;
    }

    notifyPopStateListeners(listeners);
  });

  return {
    path(includeHash = true) {
      return readAppInnerUrl(context, { includeHash });
    },

    prepareExternalUrl(internal) {
      return context.navigation.toHostPath(internal);
    },

    getState() {
      return undefined;
    },

    pushState(state, _title, url, query) {
      ignoredUrl = buildTargetUrl(url, query);
      context.navigation.navigate(ignoredUrl, { state });
    },

    replaceState(state, _title, url, query) {
      ignoredUrl = buildTargetUrl(url, query);
      context.navigation.replace(ignoredUrl, { state });
    },

    forward() {
      context.navigation.go?.(1);
    },

    back() {
      context.navigation.back();
    },

    historyGo(delta) {
      goThroughHistory(context.navigation, delta);
    },

    onPopState(listener) {
      listeners.add(listener);
    },

    getBaseHref() {
      return '/';
    },

    ngOnDestroy() {
      stop();
      listeners.clear();
    },
  };
}

function buildTargetUrl(url: string, query: string): string {
  return `${url.startsWith('/') ? url : `/${url}`}${query || ''}`;
}

function notifyPopStateListeners(listeners: Set<PopStateListener>): void {
  for (const listener of listeners) {
    listener({ type: 'popstate', state: undefined });
  }
}

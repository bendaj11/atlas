import type { AtlasAppContext } from '../../lifecycle.js';

export interface AppInnerUrlOptions {
  readonly includeHash?: boolean;
}

/** Builds the app-relative URL (inner pathname + host search + host hash) for a mounted app. */
export function readAppInnerUrl(
  context: Pick<AtlasAppContext, 'route' | 'navigation'>,
  options: AppInnerUrlOptions = {},
): string {
  const inner = context.route.getCurrent();
  const host = context.navigation.getCurrentLocation();
  const hash = options.includeHash === false ? '' : host.hash;

  return `${inner.pathname}${host.search}${hash}`;
}

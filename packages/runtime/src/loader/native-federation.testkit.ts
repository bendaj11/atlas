import type { AtlasFederationAdapter } from './native-federation.types.js';

export function aFederationAdapter(
  overrides: Partial<AtlasFederationAdapter> = {},
): AtlasFederationAdapter {
  return {
    initFederation: async () => undefined,
    loadRemoteModule: async () => ({ mount() {} }),
    ...overrides,
  };
}

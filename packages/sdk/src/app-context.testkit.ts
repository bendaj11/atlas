import type { AtlasAppContext } from './lifecycle.js';

export function createAppContext(remoteEntryUrl: string): AtlasAppContext {
  return {
    manifest: {
      schemaVersion: '1',
      kind: 'app',
      id: 'orders',
      name: 'Orders',
      version: '1.2.3',
      buildId: 'build',
      channel: 'production',
      framework: 'angular',
      remoteEntryUrl,
      exposes: { entry: './entry' },
      requiredHostSdkVersion: '^1.0.0',
      supportedHosts: ['*'],
      placements: [],
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    hostId: 'host',
    path: '/orders',
    navigation: {
      path: '/orders',
      navigate: () => undefined,
      replace: () => undefined,
      back: () => undefined,
      createHref: (path) => path,
      subscribe: () => () => undefined,
      getCurrentLocation: () => ({ pathname: '/', search: '', hash: '' }),
      toInnerPath: (path) => path,
    },
    route: {
      path: '/orders',
      getCurrent: () => ({ pathname: '/', query: {}, hash: '' }),
      setTabTitle: () => undefined,
      subscribe: () => () => undefined,
      match: () => undefined,
    },
    loading: {
      show: () => undefined,
      hide: () => undefined,
      waitUntilReady: () => () => undefined,
    },
  };
}

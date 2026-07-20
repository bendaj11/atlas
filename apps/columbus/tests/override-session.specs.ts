import { expect, test } from '@jest/globals';
import type {
  AtlasExtensionManifest,
  AtlasHostData,
} from '../src/contracts.js';
import {
  clearAllOverridesInSession,
  clearOverrideInSession,
  saveOverrideInSession,
  setOverrideScopeInSession,
  toggleOverrideInSession,
} from '../src/popup/override-session.js';
import type { PopupSession } from '../src/popup/types.js';

test('saving an override replaces disabled state for that artifact', () => {
  const production = manifest({ channel: 'production' });
  const selected = manifest({ channel: 'pr', buildId: 'pr-build' });
  const session = createSession({
    disabledOverrides: new Map([['app:orders', selected]]),
  });

  const result = saveOverrideInSession(session, { production, selected });

  expect(result.activeOverrides.get('app:orders')).toBe(selected);
  expect(result.disabledOverrides.has('app:orders')).toBe(false);
});

test('toggling an active override disables it without losing selection', () => {
  const selected = manifest({ channel: 'pr' });
  const session = createSession({
    activeOverrides: new Map([['app:orders', selected]]),
  });

  const result = toggleOverrideInSession(session, 'app:orders');

  expect(result?.activeOverrides.has('app:orders')).toBe(false);
  expect(result?.disabledOverrides.get('app:orders')).toBe(selected);
});

test('toggling an unknown artifact changes nothing', () => {
  expect(
    toggleOverrideInSession(createSession(), 'app:missing'),
  ).toBeUndefined();
});

test('clearing one override removes active and disabled copies', () => {
  const selected = manifest({ channel: 'local' });
  const result = clearOverrideInSession(
    createSession({
      activeOverrides: new Map([['app:orders', selected]]),
      disabledOverrides: new Map([['app:orders', selected]]),
    }),
    'app:orders',
  );

  expect(result.activeOverrides.size).toBe(0);
  expect(result.disabledOverrides.size).toBe(0);
});

test('clearing all overrides preserves host and scope metadata', () => {
  const session = createSession({ scope: 'tab' });

  const result = clearAllOverridesInSession(session);

  expect(result).toMatchObject({
    hostData: session.hostData,
    tabId: session.tabId,
    scope: 'tab',
  });
  expect(result.activeOverrides.size + result.disabledOverrides.size).toBe(0);
});

test('changing scope leaves selections intact', () => {
  const selected = manifest({ channel: 'pr' });
  const session = createSession({
    activeOverrides: new Map([['app:orders', selected]]),
  });

  const result = setOverrideScopeInSession(session, 'tab');

  expect(result.scope).toBe('tab');
  expect(result.activeOverrides.get('app:orders')).toBe(selected);
});

function createSession(overrides: Partial<PopupSession> = {}): PopupSession {
  const host = manifest({ kind: 'host', id: 'host', name: 'Host' });
  const hostData: AtlasHostData = {
    config: {
      schemaVersion: '1',
      hostId: 'host',
      catalogUrl: 'https://registry.example/hosts/host/catalog.json',
    },
    pageUrl: 'https://host.example/',
    catalog: {
      schemaVersion: '1',
      hostId: 'host',
      revision: 'test',
      host,
      apps: [manifest({})],
    },
    versions: {},
    overrides: undefined,
    overrideScope: undefined,
    runtimeErrors: [],
    versionErrors: [],
  };
  return {
    hostData,
    tabId: 7,
    activeOverrides: new Map(),
    disabledOverrides: new Map(),
    scope: 'all',
    ...overrides,
  };
}

function manifest(
  overrides: Partial<AtlasExtensionManifest>,
): AtlasExtensionManifest {
  return {
    schemaVersion: '1',
    kind: 'app',
    id: 'orders',
    name: 'Orders',
    version: '1.0.0',
    buildId: 'build',
    channel: 'production',
    framework: 'react',
    remoteEntryUrl: 'https://cdn.example/remoteEntry.json',
    supportedHosts: ['host'],
    placements: [],
    ...overrides,
  };
}

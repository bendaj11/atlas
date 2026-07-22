import type {
  AtlasExtensionManifest,
  AtlasHostData,
} from '../../../types/contracts.js';
import {
  clearAllOverridesInSession,
  clearOverrideInSession,
  saveOverrideInSession,
  setOverrideScopeInSession,
  toggleOverrideInSession,
} from './override-session.js';
import type { ExtensionSession } from '../../../types/app.js';

export class OverrideSessionDriver {
  private session = createSession();

  readonly given = {
    activeOverride: (): this => {
      this.session.activeOverrides.set(
        'app:orders',
        manifest({ channel: 'pr' }),
      );
      return this;
    },
    disabledOverride: (): this => {
      this.session.disabledOverrides.set(
        'app:orders',
        manifest({ channel: 'pr', buildId: 'pr-build' }),
      );
      return this;
    },
    scope: (scope: ExtensionSession['scope']): this => {
      this.session.scope = scope;
      return this;
    },
  };

  readonly when = {
    overrideSaved: (): this => {
      this.session = saveOverrideInSession({
        session: this.session,
        selection: {
          productionManifest: manifest({ channel: 'production' }),
          selectedManifest: manifest({ channel: 'pr', buildId: 'pr-build' }),
        },
      });
      return this;
    },
    overrideToggled: (artifactKey = 'app:orders'): this => {
      const nextSession = toggleOverrideInSession({
        session: this.session,
        artifactKey,
      });
      if (nextSession) this.session = nextSession;
      return this;
    },
    overrideCleared: (): this => {
      this.session = clearOverrideInSession({
        session: this.session,
        artifactKey: 'app:orders',
      });
      return this;
    },
    allOverridesCleared: (): this => {
      this.session = clearAllOverridesInSession(this.session);
      return this;
    },
    scopeChanged: (scope: ExtensionSession['scope']): this => {
      this.session = setOverrideScopeInSession({
        session: this.session,
        scope,
      });
      return this;
    },
  };

  readonly get = {
    session: (): ExtensionSession => this.session,
    activeOverride: (): AtlasExtensionManifest | undefined =>
      this.session.activeOverrides.get('app:orders'),
    disabledOverride: (): AtlasExtensionManifest | undefined =>
      this.session.disabledOverrides.get('app:orders'),
  };
}

function createSession(): ExtensionSession {
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

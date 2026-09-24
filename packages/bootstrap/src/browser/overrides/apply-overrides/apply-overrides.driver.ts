import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import type { applyOverridesDocument as applyOverridesDocumentType } from '../apply-overrides-document/apply-overrides-document.js';
import type {
  discoverDevelopmentSession as discoverDevelopmentSessionType,
  isDevelopmentSessionSeeded as isDevelopmentSessionSeededType,
  storeDevelopmentSession as storeDevelopmentSessionType,
  readStoredOverridesDocument as storedOverridesDocumentType,
} from '../development-session-source/development-session-source.js';
import type { mergeDevelopmentSession as mergeDevelopmentSessionType } from '../merge-development-session/merge-development-session.js';
import type { DevSession, OverridesDependencies } from '../overrides.types.js';

const applyOverridesDocument = jest.fn<typeof applyOverridesDocumentType>();
const discoverDevelopmentSession =
  jest.fn<typeof discoverDevelopmentSessionType>();
const isDevelopmentSessionSeeded =
  jest.fn<typeof isDevelopmentSessionSeededType>();
const storeDevelopmentSession = jest.fn<typeof storeDevelopmentSessionType>();
const readStoredOverridesDocument =
  jest.fn<typeof storedOverridesDocumentType>();
const mergeDevelopmentSession = jest.fn<typeof mergeDevelopmentSessionType>();
jest.unstable_mockModule(
  '../apply-overrides-document/apply-overrides-document.js',
  () => ({
    applyOverridesDocument,
  }),
);
jest.unstable_mockModule(
  '../development-session-source/development-session-source.js',
  () => ({
    discoverDevelopmentSession,
    isDevelopmentSessionSeeded,
    storeDevelopmentSession,
    readStoredOverridesDocument,
  }),
);
jest.unstable_mockModule(
  '../merge-development-session/merge-development-session.js',
  () => ({
    mergeDevelopmentSession,
  }),
);
const { applyOverrides } = await import('./apply-overrides.js');

export class ApplyOverridesDriver {
  private runtime!: AtlasHostRuntimeConfig;
  private catalog!: AtlasHostCatalog;
  private developmentSession: DevSession | undefined;
  private readonly dependencies = {} as OverridesDependencies;
  private result: AtlasHostCatalog | undefined;
  private error: unknown;

  constructor() {
    for (const mock of [
      applyOverridesDocument,
      discoverDevelopmentSession,
      isDevelopmentSessionSeeded,
      storeDevelopmentSession,
      readStoredOverridesDocument,
      mergeDevelopmentSession,
    ]) {
      mock.mockReset();
    }
    discoverDevelopmentSession.mockResolvedValue(undefined);
    isDevelopmentSessionSeeded.mockReturnValue(false);
    readStoredOverridesDocument.mockReturnValue(null);
    storeDevelopmentSession.mockImplementation(({ session }) =>
      JSON.stringify(session),
    );
  }

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig) => {
      this.runtime = runtime;

      return this;
    },
    catalog: (catalog: AtlasHostCatalog) => {
      this.catalog = catalog;

      return this;
    },
    suppliedSession: (session: DevSession) => {
      this.developmentSession = session;

      return this;
    },
    discoveredSession: (session: DevSession | undefined) => {
      discoverDevelopmentSession.mockResolvedValue(session);

      return this;
    },
    sessionSeeded: (seeded: boolean) => {
      isDevelopmentSessionSeeded.mockReturnValue(seeded);

      return this;
    },
    mergedCatalog: (catalog: AtlasHostCatalog) => {
      mergeDevelopmentSession.mockReturnValue(catalog);

      return this;
    },
    storedDocument: (document: unknown) => {
      readStoredOverridesDocument.mockReturnValue(JSON.stringify(document));

      return this;
    },
    overriddenCatalog: (catalog: AtlasHostCatalog) => {
      applyOverridesDocument.mockResolvedValue(catalog);

      return this;
    },
  };

  readonly when = {
    applied: async () => {
      try {
        this.result = await applyOverrides({
          runtime: this.runtime,
          catalog: this.catalog,
          ...(this.developmentSession === undefined
            ? {}
            : { developmentSession: this.developmentSession }),
          dependencies: this.dependencies,
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    result: () => this.result,
    error: () => this.error,
    discoverDevelopmentSessionMock: () => discoverDevelopmentSession,
    storeDevelopmentSessionMock: () => storeDevelopmentSession,
    mergeDevelopmentSessionMock: () => mergeDevelopmentSession,
    applyOverridesDocumentMock: () => applyOverridesDocument,
  };
}

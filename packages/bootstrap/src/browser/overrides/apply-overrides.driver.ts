import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import type { applyOverridesDocument as applyOverridesDocumentType } from './apply-overrides-document.js';
import type {
  discoverDevelopmentSession as discoverDevelopmentSessionType,
  storeDevelopmentSession as storeDevelopmentSessionType,
  storedOverridesDocument as storedOverridesDocumentType,
} from './development-session-source.js';
import type { mergeDevelopmentSession as mergeDevelopmentSessionType } from './merge-development-session.js';
import type { DevSession, OverridesDependencies } from './overrides.types.js';

const applyOverridesDocument = jest.fn<typeof applyOverridesDocumentType>();
const discoverDevelopmentSession =
  jest.fn<typeof discoverDevelopmentSessionType>();
const storeDevelopmentSession = jest.fn<typeof storeDevelopmentSessionType>();
const storedOverridesDocument = jest.fn<typeof storedOverridesDocumentType>();
const mergeDevelopmentSession = jest.fn<typeof mergeDevelopmentSessionType>();
jest.unstable_mockModule('./apply-overrides-document.js', () => ({
  applyOverridesDocument,
}));
jest.unstable_mockModule('./development-session-source.js', () => ({
  discoverDevelopmentSession,
  storeDevelopmentSession,
  storedOverridesDocument,
}));
jest.unstable_mockModule('./merge-development-session.js', () => ({
  mergeDevelopmentSession,
}));
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
      storeDevelopmentSession,
      storedOverridesDocument,
      mergeDevelopmentSession,
    ]) {
      mock.mockReset();
    }
    discoverDevelopmentSession.mockResolvedValue(undefined);
    storedOverridesDocument.mockReturnValue(null);
    storeDevelopmentSession.mockImplementation(({ session }) =>
      JSON.stringify(session),
    );
  }

  readonly given = {
    runtime: (runtime: AtlasHostRuntimeConfig): ApplyOverridesDriver => {
      this.runtime = runtime;

      return this;
    },
    catalog: (catalog: AtlasHostCatalog): ApplyOverridesDriver => {
      this.catalog = catalog;

      return this;
    },
    suppliedSession: (session: DevSession): ApplyOverridesDriver => {
      this.developmentSession = session;

      return this;
    },
    discoveredSession: (
      session: DevSession | undefined,
    ): ApplyOverridesDriver => {
      discoverDevelopmentSession.mockResolvedValue(session);

      return this;
    },
    mergedCatalog: (catalog: AtlasHostCatalog): ApplyOverridesDriver => {
      mergeDevelopmentSession.mockReturnValue(catalog);

      return this;
    },
    storedDocument: (document: unknown): ApplyOverridesDriver => {
      storedOverridesDocument.mockReturnValue(JSON.stringify(document));

      return this;
    },
    overriddenCatalog: (catalog: AtlasHostCatalog): ApplyOverridesDriver => {
      applyOverridesDocument.mockResolvedValue(catalog);

      return this;
    },
  };

  readonly when = {
    applied: async (): Promise<void> => {
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
    result: (): AtlasHostCatalog | undefined => this.result,
    error: (): unknown => this.error,
    discoverDevelopmentSessionMock: () => discoverDevelopmentSession,
    storeDevelopmentSessionMock: () => storeDevelopmentSession,
    mergeDevelopmentSessionMock: () => mergeDevelopmentSession,
    applyOverridesDocumentMock: () => applyOverridesDocument,
  };
}

import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import {
  ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY,
  loadBrowserRuntimeOverrides,
} from './overrides.js';
import type {
  AtlasRuntimeOverride,
  RequestDevelopmentSession,
} from './overrides.types.js';

export class OverridesDriver {
  private hostId = faker.string.uuid();
  private storedDocument: string | null = null;
  private readonly developmentSession = jest
    .fn<RequestDevelopmentSession>()
    .mockResolvedValue(undefined);
  private readonly setItem = jest.fn<(key: string, value: string) => void>();
  private overrides: AtlasRuntimeOverride[] | undefined;
  private error: unknown;

  readonly given = {
    hostId: (hostId: string) => {
      this.hostId = hostId;

      return this;
    },
    developmentSessionDocument: (document: unknown) => {
      this.developmentSession.mockResolvedValue(document);

      return this;
    },
    storedDocument: (document: unknown) => {
      this.storedDocument = JSON.stringify(document);

      return this;
    },
    storedText: (text: string) => {
      this.storedDocument = text;

      return this;
    },
  };

  readonly when = {
    loaded: async () => {
      try {
        this.overrides = await loadBrowserRuntimeOverrides({
          hostId: this.hostId,
          developmentSession: this.developmentSession,
          sessionStorage: {
            getItem: (key) =>
              key === ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY
                ? this.storedDocument
                : null,
            setItem: this.setItem,
          },
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    overrides: () => this.overrides!,
    developmentSessionMock: () => this.developmentSession,
    setItemMock: () => this.setItem,
    error: () => this.error,
  };
}

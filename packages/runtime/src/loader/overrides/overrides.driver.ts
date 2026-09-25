import { jest } from '@jest/globals';
import {
  dismissedDevelopmentOffersKey,
  type AtlasDevelopmentOfferIds,
  type AtlasDevelopmentOffers,
  type AtlasRuntimeOverrideDocument,
} from '@atlas/schema';
import { ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY } from './overrides.js';
import type { RequestDevelopmentSession } from './overrides.types.js';

export class OverridesDriver {
  private readonly developmentSession = jest.fn<RequestDevelopmentSession>();

  constructor() {
    sessionStorage.clear();
    localStorage.clear();
    this.developmentSession.mockResolvedValue(undefined);
  }

  readonly given = {
    developmentSession: (
      session: AtlasRuntimeOverrideDocument & AtlasDevelopmentOffers,
    ) => {
      this.developmentSession.mockResolvedValue(session);

      return this;
    },
    tabDocument: (document: AtlasRuntimeOverrideDocument | null) => {
      sessionStorage.setItem(
        ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY,
        JSON.stringify(document),
      );

      return this;
    },
    tabText: (text: string) => {
      sessionStorage.setItem(ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY, text);

      return this;
    },
    originDocument: (document: AtlasRuntimeOverrideDocument) => {
      localStorage.setItem(
        ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY,
        JSON.stringify(document),
      );

      return this;
    },
    originDismissedOffers: (
      hostId: string,
      offerIds: AtlasDevelopmentOfferIds,
    ) => {
      localStorage.setItem(
        dismissedDevelopmentOffersKey(hostId),
        JSON.stringify(offerIds),
      );

      return this;
    },
  };

  readonly get = {
    dependencies: () => ({
      developmentSession: this.developmentSession,
      sessionStorage,
      localStorage,
    }),
  };
}

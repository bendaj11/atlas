import { jest } from '@jest/globals';
import {
  dismissedDevelopmentOffersKey,
  type AtlasDevelopmentOfferIds,
  type AtlasHostCatalog,
} from '@atlas/schema';
import type { applyOverridesDocument as applyOverridesDocumentType } from '../apply-overrides-document/apply-overrides-document.js';
import type { fetchJson } from '../../fetch-json/index.js';
import type { loadPublishedArtifact } from '../../published-artifact/index.js';
import { OVERRIDES_STORAGE_KEY } from '../overrides.constants.js';
import type { RuntimeOverrides } from '../overrides.types.js';

const applyOverridesDocument = jest.fn<typeof applyOverridesDocumentType>();
jest.unstable_mockModule(
  '../apply-overrides-document/apply-overrides-document.js',
  () => ({ applyOverridesDocument }),
);

export class ApplyOverridesDriver {
  private readonly fetchJson = jest.fn<typeof fetchJson>();
  private readonly loadPublishedArtifact =
    jest.fn<typeof loadPublishedArtifact>();

  constructor() {
    applyOverridesDocument.mockReset();
    sessionStorage.clear();
    localStorage.clear();
  }

  readonly given = {
    tabDocument: (document: RuntimeOverrides) => {
      sessionStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(document));

      return this;
    },
    originDocument: (document: RuntimeOverrides) => {
      localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(document));

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
    overriddenCatalog: (catalog: AtlasHostCatalog) => {
      applyOverridesDocument.mockResolvedValue(catalog);

      return this;
    },
  };

  readonly get = {
    dependencies: () => ({
      sessionStorage,
      localStorage,
      fetchJson: this.fetchJson as typeof fetchJson,
      loadPublishedArtifact: this.loadPublishedArtifact,
    }),
    applyOverridesDocumentMock: () => applyOverridesDocument,
  };
}

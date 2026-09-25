import { jest } from '@jest/globals';
import type { AtlasDevelopmentOfferIds } from '@atlas/schema';
import type { AtlasOverrideDocument } from '../../types/override-document';
import {
  type FakeChrome,
  installFakeChrome,
} from '../../testkit/chrome.testkit';

interface DevelopmentSessionDocument extends AtlasOverrideDocument {
  offerIds?: AtlasDevelopmentOfferIds | null;
}

type DevelopmentSessionResponse =
  { document: DevelopmentSessionDocument | null } | { error: string };

export class DevelopmentOffersDriver {
  private readonly chrome = installFakeChrome();
  private readonly runtimeMessage = jest.fn<FakeChrome['onRuntimeMessage']>();

  constructor() {
    sessionStorage.clear();
    history.replaceState(null, '', '/');
    this.chrome.onRuntimeMessage = this.runtimeMessage;
  }

  readonly given = {
    pagePath: (path: string) => {
      history.replaceState(null, '', path);

      return this;
    },
    sessionStorageItem: (key: string, value: string) => {
      sessionStorage.setItem(key, value);

      return this;
    },
    runtimeResponse: (response: DevelopmentSessionResponse) => {
      this.runtimeMessage.mockResolvedValue(response);

      return this;
    },
    runtimeFailure: (error: Error) => {
      this.runtimeMessage.mockRejectedValue(error);

      return this;
    },
  };

  readonly get = {
    pageUrl: () => location.href,
    runtimeMessage: () => this.runtimeMessage,
  };
}

import { jest } from '@jest/globals';
import type { ArtifactVersion } from '../../../types/artifact-version';
import type { HostData } from '../../../types/host-data';
import type { ContentResponse } from '../../shared/messages/messages';
import {
  type FakeChrome,
  type FakeTab,
  installFakeChrome,
} from '../../../testkit/chrome.testkit';

type TabMessageResponse =
  | ContentResponse<{ hostData: HostData }>
  | ContentResponse<{ manifest: ArtifactVersion }>
  | null;

export class HostTabsDriver {
  private readonly chrome: FakeChrome = installFakeChrome();
  private readonly tabMessage = jest.fn<FakeChrome['onTabMessage']>();

  constructor() {
    this.chrome.onTabMessage = this.tabMessage;
  }

  readonly given = {
    tabs: (tabs: FakeTab[]) => {
      this.chrome.tabs = tabs;

      return this;
    },
    tabMessageResponse: (response: TabMessageResponse) => {
      this.tabMessage.mockResolvedValueOnce(response);

      return this;
    },
  };

  readonly get = {
    tabMessage: () => this.tabMessage,
    reloadedTabIds: () => this.chrome.reloadedTabIds,
  };
}

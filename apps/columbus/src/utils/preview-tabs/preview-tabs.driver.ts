import {
  type FakeChrome,
  type FakeTab,
  installFakeChrome,
} from '../../testkit/chrome.testkit';

export class PreviewTabsDriver {
  private readonly chrome: FakeChrome = installFakeChrome();

  readonly given = {
    openTabs: (tabs: FakeTab[]) => {
      this.chrome.tabs = tabs;

      return this;
    },
  };

  readonly get = {
    activatedTabIds: () => this.chrome.activatedTabIds,
    focusedWindowIds: () => this.chrome.focusedWindowIds,
    reloadedTabIds: () => this.chrome.reloadedTabIds,
    removedTabIds: () => this.chrome.removedTabIds,
  };
}

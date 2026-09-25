import { jest } from '@jest/globals';
import {
  type FakeChrome,
  installFakeChrome,
} from '../../../testkit/chrome.testkit';

export class PreviewLauncherContentDriver {
  private readonly chrome: FakeChrome = installFakeChrome();
  private readonly runtimeMessage = jest.fn<FakeChrome['onRuntimeMessage']>();

  constructor() {
    jest.resetModules();
    document.documentElement.removeAttribute('data-atlas-preview-launcher');
    history.replaceState(null, '', '/');
    this.chrome.onRuntimeMessage = this.runtimeMessage;
    this.runtimeMessage.mockResolvedValue({ focused: true });
  }

  readonly given = {
    pagePath: (path: string) => {
      history.replaceState(null, '', path);

      return this;
    },
  };

  readonly when = {
    started: async () => {
      await import('./preview-launcher-content');
    },
  };

  readonly get = {
    launcherMarked: () =>
      document.documentElement.hasAttribute('data-atlas-preview-launcher'),
    runtimeMessage: () => this.runtimeMessage,
  };
}

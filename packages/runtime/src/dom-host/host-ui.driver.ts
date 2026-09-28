import { jest } from '@jest/globals';
import type { RenderHostError, RetryHostStart } from './dom-host.types.js';
import { AtlasHostAnchorRegistry } from './host-anchors.js';
import { createHostUi } from './host-ui.js';
import type { AtlasHostUi } from './host-ui.types.js';

export class HostUiDriver {
  private readonly anchors = new AtlasHostAnchorRegistry();
  private readonly container = document.body.appendChild(
    document.createElement('div'),
  );
  private readonly hostContainer = document.body.appendChild(
    document.createElement('div'),
  );
  private useFallbackContainer = false;
  private readonly disposeError = jest.fn<() => void>();
  private readonly renderHostError = jest
    .fn<RenderHostError>()
    .mockReturnValue(this.disposeError);
  private readonly retry = jest.fn<RetryHostStart>();
  private useCustomRenderer = false;
  private ui!: AtlasHostUi;

  readonly given = {
    customRenderer: () => {
      this.useCustomRenderer = true;

      return this;
    },
    statusAnchor: () => {
      this.anchors.register('status', this.container);

      return this;
    },
    statusAnchorChild: (child: Node) => {
      this.container.append(child);

      return this;
    },
    fallbackContainer: () => {
      this.useFallbackContainer = true;

      return this;
    },
    fallbackContainerChild: (child: Node) => {
      this.hostContainer.append(child);

      return this;
    },
  };

  readonly when = {
    created: () => {
      this.ui = createHostUi({
        document,
        anchors: this.anchors,
        ...(this.useFallbackContainer
          ? { fallbackContainer: this.hostContainer }
          : {}),
        ...(this.useCustomRenderer
          ? { renderHostError: this.renderHostError }
          : {}),
      });
    },
    errorShown: (error: Error) => this.ui.showError(error, this.retry),
    statusAnchorRegistered: () => {
      this.anchors.register('status', this.container);
    },
    cleared: () => this.ui.clear(),
    retryClicked: () => this.container.querySelector('button')!.click(),
  };

  readonly get = {
    statusAnchor: () => this.container,
    hostContainer: () => this.hostContainer,
    anchorStatus: () =>
      this.container.querySelector<HTMLElement>('[data-atlas-host-status]'),
    fallbackStatus: () =>
      this.hostContainer.querySelector<HTMLElement>('[data-atlas-host-status]'),
    renderHostErrorMock: () => this.renderHostError,
    disposeErrorMock: () => this.disposeError,
    retryMock: () => this.retry,
  };
}

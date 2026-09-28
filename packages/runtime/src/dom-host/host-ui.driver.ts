import { jest } from '@jest/globals';
import type {
  RenderHostError,
  RenderHostLoading,
  RetryHostStart,
} from './dom-host.types.js';
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
  private readonly routeOutlet = document.createElement('div');
  private useFallbackContainer = false;
  private readonly disposeLoading = jest.fn<() => void>();
  private readonly renderHostLoading = jest
    .fn<RenderHostLoading>()
    .mockReturnValue(this.disposeLoading);
  private readonly renderHostError = jest.fn<RenderHostError>();
  private readonly retry = jest.fn<RetryHostStart>();
  private useCustomRenderers = false;
  private ui: AtlasHostUi | undefined;

  readonly given = {
    customRenderers: () => {
      this.useCustomRenderers = true;

      return this;
    },
    statusAnchor: () => {
      this.anchors.register('status', this.container);

      return this;
    },
    fallbackContainer: () => {
      this.useFallbackContainer = true;

      return this;
    },
    routeOutlet: () => {
      this.anchors.register('route-outlet', this.routeOutlet);

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
        ...(this.useCustomRenderers
          ? {
              renderHostLoading: this.renderHostLoading,
              renderHostError: this.renderHostError,
            }
          : {}),
      });
    },
    loadingShown: () => this.ui!.showLoading(),
    errorShown: (error: Error) => this.ui!.showError(error, this.retry),
    statusAnchorRegistered: () => {
      this.anchors.register('status', this.container);
    },
    routeOutletRegistered: () => {
      this.anchors.register('route-outlet', this.routeOutlet);
    },
    nextRenderElapsed: () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          setTimeout(() => setTimeout(resolve, 0), 0),
        ),
      ),
    cleared: () => this.ui!.clear(),
    clearRequestedUntilHostAnchorRenders: () =>
      this.ui!.clearWhenHostAnchorRenders(),
    disposed: () => this.ui!.dispose(),
    retryClicked: () => this.container.querySelector('button')!.click(),
  };

  readonly get = {
    containerText: () => this.container.textContent ?? '',
    containerState: () => this.container.dataset.atlasState,
    containerBusy: () => this.container.getAttribute('aria-busy'),
    statusLabel: () =>
      this.container.firstElementChild?.getAttribute('aria-label') ?? null,
    hostContainerStatusLabel: () =>
      this.hostContainer
        .querySelector('[data-atlas-loader]')
        ?.getAttribute('aria-label') ?? null,
    statusRole: () =>
      this.container.firstElementChild?.getAttribute('role') ?? null,
    renderHostLoadingMock: () => this.renderHostLoading,
    renderHostErrorMock: () => this.renderHostError,
    disposeLoadingMock: () => this.disposeLoading,
    retryMock: () => this.retry,
  };
}

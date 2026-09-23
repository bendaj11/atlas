import { jest } from '@jest/globals';
import { anAppManifest, aRoutePlacement } from '@atlas/testkit';
import type { AtlasHostMountState } from '../host-runtime/host-runtime.types.js';
import { renderHostMountState, renderHostNavigation } from './dom-rendering.js';
import type {
  RenderPlacementError,
  RenderPlacementLoading,
  RetryPlacementMount,
} from './dom-host.types.js';
import type { AtlasHostNavigationItem } from './host-navigation.types.js';

export class DomRenderingDriver {
  private readonly container = document.body.appendChild(
    document.createElement('div'),
  );
  private readonly nav = document.body.appendChild(
    document.createElement('nav'),
  );
  private readonly manifest = anAppManifest({
    placements: [aRoutePlacement()],
  });
  private readonly retry = jest.fn<RetryPlacementMount>();
  private readonly renderLoading = jest.fn<RenderPlacementLoading>();
  private readonly renderError = jest.fn<RenderPlacementError>();
  private useCustomRenderers = false;

  readonly given = {
    customRenderers: () => {
      this.useCustomRenderers = true;

      return this;
    },
    nestedWidgetStatus: () => {
      const status = document.createElement('div');
      status.dataset.atlasStatus = '';

      const nested = document.createElement('section');

      nested.append(status);
      this.container.append(nested);

      return this;
    },
  };

  readonly when = {
    stateRendered: (state: AtlasHostMountState) => {
      renderHostMountState({
        document,
        event: {
          manifest: this.manifest,
          placement: this.manifest.placements[0]!,
          container: this.container,
          state,
          ...(state === 'error' ? { error: new Error('boom') } : {}),
        },
        retry: this.retry,
        options: this.useCustomRenderers
          ? { renderLoading: this.renderLoading, renderError: this.renderError }
          : {},
      });
    },
    navigationRendered: (items: readonly AtlasHostNavigationItem[]) =>
      renderHostNavigation({ document, nav: this.nav, items }),
    navigationLinkClicked: (index: number) =>
      this.nav.querySelectorAll('a')[index]!.click(),
    retryClicked: () =>
      this.container
        .querySelector<HTMLButtonElement>(
          '[data-atlas-placement-status] button',
        )!
        .click(),
  };

  readonly get = {
    manifest: () => this.manifest,
    containerState: () => this.container.dataset.atlasState,
    containerAppId: () => this.container.dataset.atlasAppId,
    containerBusy: () => this.container.getAttribute('aria-busy'),
    placementStatusText: () =>
      this.container.querySelector('[data-atlas-placement-status]')
        ?.textContent ?? undefined,
    placementStatusRole: () =>
      this.container
        .querySelector('[data-atlas-placement-status]')
        ?.getAttribute('role'),
    nestedStatusCount: () =>
      this.container.querySelectorAll('section [data-atlas-status]').length,
    childCount: () => this.container.childElementCount,
    navLinks: () => [...this.nav.querySelectorAll('a')],
    retryMock: () => this.retry,
    renderLoadingMock: () => this.renderLoading,
    renderErrorMock: () => this.renderError,
  };
}

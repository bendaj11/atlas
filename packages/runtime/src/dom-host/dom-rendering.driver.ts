import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import type { AtlasPlacement } from '@atlas/schema';
import { anAppManifest, aRoutePlacement } from '@atlas/testkit';
import type { AtlasHostMountState } from '../host-runtime/host-runtime.types.js';
import type { DisposeRenderer } from '../widget-loader/widget-loader.types.js';
import {
  createHostMountStateRenderer,
  renderHostNavigation,
} from './dom-rendering.js';
import type {
  RenderHostMountState,
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
  private placement: AtlasPlacement = this.manifest.placements[0]!;
  private readonly error = new Error(faker.lorem.sentence());
  private readonly retry = jest.fn<RetryPlacementMount>();
  private readonly renderLoading = jest.fn<RenderPlacementLoading>();
  private readonly renderError = jest.fn<RenderPlacementError>();
  private readonly disposeStatus = jest.fn<DisposeRenderer>();
  private useCustomRenderers = false;
  private renderMountState: RenderHostMountState | undefined;

  readonly given = {
    customRenderers: () => {
      this.useCustomRenderers = true;

      this.renderLoading.mockReturnValue(this.disposeStatus);
      this.renderError.mockReturnValue(this.disposeStatus);

      return this;
    },
    containerChild: () => {
      this.container.append(document.createElement('article'));

      return this;
    },
    placement: (placement: AtlasPlacement) => {
      this.placement = placement;

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
      this.renderMountState ??= createHostMountStateRenderer({
        document,
        ui: this.useCustomRenderers
          ? { renderLoading: this.renderLoading, renderError: this.renderError }
          : {},
      });

      this.renderMountState(
        {
          manifest: this.manifest,
          placement: this.placement,
          container: this.container,
          state,
          ...(state === 'error' ? { error: this.error } : {}),
        },
        this.retry,
      );
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
    customRetryCalled: () => this.renderError.mock.calls.at(-1)![2](),
  };

  readonly get = {
    manifest: () => this.manifest,
    containerState: () => this.container.dataset.atlasState,
    containerAppId: () => this.container.dataset.atlasAppId,
    containerBusy: () => this.container.getAttribute('aria-busy'),
    firstChild: () => this.container.firstElementChild,
    placementStatus: () =>
      this.container.querySelector<HTMLElement>(
        ':scope > [data-atlas-placement-status]',
      ),
    placementStatusCount: () =>
      this.container.querySelectorAll('[data-atlas-placement-status]').length,
    loaderLabel: () =>
      this.container
        .querySelector('[data-atlas-placement-status] [data-atlas-loader]')
        ?.getAttribute('aria-label'),
    loaderPadding: () =>
      this.container.querySelector<HTMLElement>(
        '[data-atlas-placement-status] [data-atlas-loader]',
      )?.style.padding,
    alertRole: () =>
      this.container
        .querySelector('[data-atlas-placement-status] [data-atlas-status]')
        ?.getAttribute('role'),
    nestedStatusCount: () =>
      this.container.querySelectorAll('section [data-atlas-status]').length,
    childCount: () => this.container.childElementCount,
    navLinks: () => [...this.nav.querySelectorAll('a')],
    retryMock: () => this.retry,
    renderLoadingMock: () => this.renderLoading,
    renderErrorMock: () => this.renderError,
    disposeStatusMock: () => this.disposeStatus,
    error: () => this.error,
  };
}

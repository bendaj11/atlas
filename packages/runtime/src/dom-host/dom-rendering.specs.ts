/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import { aRoutePlacement, aSlotPlacement } from '@atlas/testkit';
import { DomRenderingDriver } from './dom-rendering.driver.js';
import { aNavigationItem } from './host-navigation.testkit.js';
import type { NavigateToItem } from './host-navigation.types.js';

describe('createHostMountStateRenderer', () => {
  let driver: DomRenderingDriver;

  beforeEach(() => {
    driver = new DomRenderingDriver();
  });

  it('should expose the app id on the container when a state is rendered', () => {
    driver.when.stateRendered('mounted');

    expect(driver.get.containerAppId()).toBe(driver.get.manifest().id);
  });

  it('should expose the state on the container when a state is rendered', () => {
    driver.when.stateRendered('mounting');

    expect(driver.get.containerState()).toBe('mounting');
  });

  it('should remove the app id when the unmounted state follows the mounted state', () => {
    driver.when.stateRendered('mounted');

    driver.when.stateRendered('unmounted');

    expect(driver.get.containerAppId()).toBeUndefined();
  });

  it.each([
    ['slot', aSlotPlacement(), '0.25rem'],
    ['route', aRoutePlacement(), '2rem'],
  ])(
    'should pad the default loader for a %s placement when the loading state is rendered',
    (_kind, placement, padding) => {
      driver.given.placement(placement).when.stateRendered('loading');

      expect(driver.get.loaderPadding()).toBe(padding);
    },
  );

  it('should render the placement status as the first child of the container when the container has children', () => {
    driver.given.containerChild().when.stateRendered('loading');

    expect(driver.get.firstChild()).toBe(driver.get.placementStatus());
  });

  it('should keep a nested widget status when the mounted state is rendered', () => {
    driver.given.nestedWidgetStatus().when.stateRendered('mounted');

    expect(driver.get.nestedStatusCount()).toBe(1);
  });

  it('should empty the container when the unmounted state is rendered', () => {
    driver.given.nestedWidgetStatus().when.stateRendered('unmounted');

    expect(driver.get.childCount()).toBe(0);
  });

  describe('when the default loading status is rendered', () => {
    beforeEach(() => {
      driver.when.stateRendered('loading');
    });

    it('should label the default loader with the app name when rendered', () => {
      expect(driver.get.loaderLabel()).toBe(
        `Loading ${driver.get.manifest().name}`,
      );
    });

    it('should mark the container busy when rendered', () => {
      expect(driver.get.containerBusy()).toBe('true');
    });

    it('should remove the placement status when the mounted state follows', () => {
      driver.when.stateRendered('mounted');

      expect(driver.get.placementStatusCount()).toBe(0);
    });

    it('should render one placement status when the error state follows', () => {
      driver.when.stateRendered('error');

      expect(driver.get.placementStatusCount()).toBe(1);
    });
  });

  describe('when the default error status is rendered', () => {
    beforeEach(() => {
      driver.when.stateRendered('error');
    });

    it('should render the default error as an alert when rendered', () => {
      expect(driver.get.alertRole()).toBe('alert');
    });

    it('should call retry once when the default retry button is clicked twice', () => {
      driver.when.retryClicked();
      driver.when.retryClicked();

      expect(driver.get.retryMock()).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the custom loading status is rendered', () => {
    beforeEach(() => {
      driver.given.customRenderers().when.stateRendered('loading');
    });

    it('should call the custom loading renderer with the atlas status element when rendered', () => {
      expect(driver.get.renderLoadingMock()).toHaveBeenCalledWith(
        driver.get.placementStatus(),
        expect.objectContaining({ state: 'loading' }),
      );
    });

    it('should dispose the loading status before the error renderer runs when the error state follows', () => {
      driver.when.stateRendered('error');

      expect(
        driver.get.disposeStatusMock().mock.invocationCallOrder[0],
      ).toBeLessThan(driver.get.renderErrorMock().mock.invocationCallOrder[0]!);
    });

    it('should remove the placement status when the mounted state follows', () => {
      driver.when.stateRendered('mounted');

      expect(driver.get.placementStatusCount()).toBe(0);
    });

    it('should dispose the status when the unmounted state follows', () => {
      driver.when.stateRendered('unmounted');

      expect(driver.get.disposeStatusMock()).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the custom error status is rendered', () => {
    beforeEach(() => {
      driver.given.customRenderers().when.stateRendered('error');
    });

    it('should call the custom error renderer with the atlas status element and the error when rendered', () => {
      expect(driver.get.renderErrorMock()).toHaveBeenCalledWith(
        driver.get.placementStatus(),
        expect.objectContaining({ error: driver.get.error() }),
        expect.any(Function),
      );
    });

    it('should call retry once when the custom error retry is called twice', () => {
      driver.when.customRetryCalled();
      driver.when.customRetryCalled();

      expect(driver.get.retryMock()).toHaveBeenCalledTimes(1);
    });
  });
});

describe('renderHostNavigation', () => {
  let driver: DomRenderingDriver;

  beforeEach(() => {
    driver = new DomRenderingDriver();
  });

  describe('when two items are rendered and the first is active', () => {
    const navigate = jest.fn<NavigateToItem>();
    const items = [
      aNavigationItem({ active: true, navigate }),
      aNavigationItem({ active: false }),
    ];

    beforeEach(() => {
      driver.when.navigationRendered(items);
    });

    it('should render one link per item with its href and label when rendered', () => {
      expect(
        driver.get
          .navLinks()
          .map((link) => [link.getAttribute('href'), link.textContent]),
      ).toEqual(items.map((item) => [item.href, item.label]));
    });

    it('should mark only the active link with aria-current when rendered', () => {
      expect(
        driver.get.navLinks().map((link) => link.getAttribute('aria-current')),
      ).toEqual(['page', null]);
    });

    it('should call the item navigate when its link is clicked', () => {
      driver.when.navigationLinkClicked(0);

      expect(navigate).toHaveBeenCalledTimes(1);
    });
  });
});

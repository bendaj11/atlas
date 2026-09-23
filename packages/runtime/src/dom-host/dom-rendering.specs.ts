/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import { DomRenderingDriver } from './dom-rendering.driver.js';
import { aNavigationItem } from './host-navigation.testkit.js';
import type { NavigateToItem } from './host-navigation.types.js';

describe('renderHostMountState', () => {
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

  it('should render a status with the app name when the loading state is rendered', () => {
    driver.when.stateRendered('loading');

    expect(driver.get.placementStatusText()).toBe(
      `Loading ${driver.get.manifest().name}...`,
    );
  });

  it('should mark the container busy when the loading state is rendered', () => {
    driver.when.stateRendered('loading');

    expect(driver.get.containerBusy()).toBe('true');
  });

  it('should render an alert with a retry button when the error state is rendered', () => {
    driver.when.stateRendered('error');

    expect(driver.get.placementStatusRole()).toBe('alert');
  });

  it('should call retry when the error retry button is clicked', () => {
    driver.when.stateRendered('error');

    driver.when.retryClicked();

    expect(driver.get.retryMock()).toHaveBeenCalledTimes(1);
  });

  it('should remove the placement status when the mounted state follows the loading state', () => {
    driver.when.stateRendered('loading');

    driver.when.stateRendered('mounted');

    expect(driver.get.placementStatusText()).toBeUndefined();
  });

  it('should keep a nested widget status when the mounted state is rendered', () => {
    driver.given.nestedWidgetStatus().when.stateRendered('mounted');

    expect(driver.get.nestedStatusCount()).toBe(1);
  });

  it('should empty the container when the unmounted state is rendered', () => {
    driver.given.nestedWidgetStatus().when.stateRendered('unmounted');

    expect(driver.get.childCount()).toBe(0);
  });

  it('should remove the app id when the unmounted state is rendered', () => {
    driver.when.stateRendered('mounted');

    driver.when.stateRendered('unmounted');

    expect(driver.get.containerAppId()).toBeUndefined();
  });

  it('should call the custom loading renderer when the loading state is rendered', () => {
    driver.given.customRenderers().when.stateRendered('loading');

    expect(driver.get.renderLoadingMock()).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ state: 'loading' }),
    );
  });

  it('should call the custom error renderer with retry when the error state is rendered', () => {
    driver.given.customRenderers().when.stateRendered('error');

    expect(driver.get.renderErrorMock()).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ state: 'error' }),
      driver.get.retryMock(),
    );
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

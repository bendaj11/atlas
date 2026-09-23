/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { HostAnchorsDriver } from './host-anchors.driver.js';

describe('AtlasHostAnchorRegistry', () => {
  let driver: HostAnchorsDriver;

  beforeEach(() => {
    driver = new HostAnchorsDriver();
  });

  it.each(['status', 'navigation', 'route-outlet'] as const)(
    'should return the registered element when the %s anchor is registered',
    (kind) => {
      const element = document.createElement('div');
      driver.when.registered(kind, element);

      expect(driver.get.anchor(kind)).toBe(element);
    },
  );

  it('should return the registered element by name when a slot anchor is registered', () => {
    const name = faker.word.noun();
    const element = document.createElement('div');
    driver.when.registered('slot', element, name);

    expect(driver.get.slot(name)).toBe(element);
  });

  it('should throw ATLAS_SLOT_NAME_MISSING when a slot anchor is registered without a name', () => {
    driver.when.registered('slot', document.createElement('div'));

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_SLOT_NAME_MISSING',
    });
  });

  it('should notify subscribers when an anchor is registered', () => {
    driver.given
      .subscribed()
      .when.registered('status', document.createElement('div'));

    expect(driver.get.listenerMock()).toHaveBeenCalledTimes(1);
  });

  describe('when the same kind is registered twice', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');

    beforeEach(() => {
      driver.when.registered('status', first);
      driver.when.registered('status', second);
    });

    it('should return the latest element when read', () => {
      expect(driver.get.anchor('status')).toBe(second);
    });

    it('should keep the latest element when the first registration is released', () => {
      driver.when.released(0);

      expect(driver.get.anchor('status')).toBe(second);
    });

    it('should forget the anchor when the latest registration is released', () => {
      driver.when.released(1);

      expect(driver.get.anchor('status')).toBeUndefined();
    });
  });

  it('should notify layout subscribers when the active layout changes', () => {
    driver.given.layoutsSubscribed().when.activeLayoutSet(faker.word.noun());

    expect(driver.get.layoutListenerMock()).toHaveBeenCalledTimes(1);
  });

  it('should not notify layout subscribers when the same layout is set again', () => {
    const layoutId = faker.word.noun();
    driver.given.layoutsSubscribed().when.activeLayoutSet(layoutId);

    driver.when.activeLayoutSet(layoutId);

    expect(driver.get.layoutListenerMock()).toHaveBeenCalledTimes(1);
  });

  it('should return the active layout when one was set', () => {
    const layoutId = faker.word.noun();
    driver.when.activeLayoutSet(layoutId);

    expect(driver.get.activeLayout()).toBe(layoutId);
  });
});

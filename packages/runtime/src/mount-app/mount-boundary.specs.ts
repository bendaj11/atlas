/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { MountBoundaryDriver } from './mount-boundary.driver.js';

describe('createMountBoundary', () => {
  let driver: MountBoundaryDriver;

  beforeEach(() => {
    driver = new MountBoundaryDriver();
  });

  describe('when the isolation is shadow-dom', () => {
    beforeEach(() => {
      driver.given.isolation('shadow-dom');
    });

    it('should return a container inside an open shadow root when created', () => {
      driver.when.created();

      expect(driver.get.container().getRootNode()).toBeInstanceOf(ShadowRoot);
    });

    it('should use the shadow root as style target when created', () => {
      driver.when.created();

      expect(driver.get.styleTarget()).toBe(
        driver.get.container().getRootNode(),
      );
    });

    it('should mark the container as isolation root when created', () => {
      driver.when.created();

      expect(driver.get.container().dataset.atlasIsolationRoot).toBe('');
    });
  });

  it.each(['shared-dom', 'scoped'] as const)(
    'should use the document head as style target when the isolation is %s',
    (isolation) => {
      driver.given.isolation(isolation).when.created();

      expect(driver.get.styleTarget()).toBe(document.head);
    },
  );

  it('should tag the boundary element with the app id when the kind is app', () => {
    const id = faker.string.uuid();
    driver.given.id(id).given.kind('app').when.created();

    expect(driver.get.parentChild()).toMatchObject({
      dataset: { atlasApp: id },
    });
  });

  it('should tag the boundary element with the widget id when the kind is widget', () => {
    const id = faker.string.uuid();
    driver.given.id(id).given.kind('widget').when.created();

    expect(driver.get.parentChild()).toMatchObject({
      dataset: { atlasWidget: id },
    });
  });

  it('should remove the boundary element from the parent when removed', () => {
    driver.when.created();

    driver.when.removed();

    expect(driver.get.parentChildCount()).toBe(0);
  });

  it.each(['shared-dom', 'scoped'] as const)(
    'should throw ATLAS_STYLE_TARGET_MISSING when the document has no head and the isolation is %s',
    (isolation) => {
      driver.given.headlessDocument().given.isolation(isolation).when.created();

      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_STYLE_TARGET_MISSING',
      });
    },
  );

  it('should leave the parent empty when the document has no head and the isolation is shared-dom', () => {
    driver.given
      .headlessDocument()
      .given.isolation('shared-dom')
      .when.created();

    expect(driver.get.parentChildCount()).toBe(0);
  });
});

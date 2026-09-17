import { aHostCatalog, aHostRuntimeConfig } from '@atlas/testkit';
import { RuntimeSnapshotDriver } from './runtime-snapshot.driver.js';

describe('publishRuntimeSnapshot', () => {
  let driver: RuntimeSnapshotDriver;

  beforeEach(() => {
    driver = new RuntimeSnapshotDriver();
  });

  describe('when no snapshot element exists', () => {
    const runtime = aHostRuntimeConfig();
    const catalog = aHostCatalog();

    beforeEach(() => {
      driver.when.published({ runtime, catalog });
    });

    it('should create a JSON script element holding the snapshot when published', () => {
      expect(driver.get.createdElement()).toEqual({
        id: 'atlas-runtime-snapshot',
        type: 'application/json',
        textContent: JSON.stringify({ schemaVersion: '1', runtime, catalog }),
      });
    });

    it('should append the element to the head when published', () => {
      expect(driver.get.appendMock()).toHaveBeenCalledWith(
        driver.get.createdElement(),
      );
    });
  });

  describe('when a snapshot element already exists', () => {
    const existing = {
      id: 'atlas-runtime-snapshot',
      type: 'application/json',
      textContent: '',
    };
    const runtime = aHostRuntimeConfig();
    const catalog = aHostCatalog();

    beforeEach(() => {
      driver.given.existingSnapshotElement(existing);
      driver.when.published({ runtime, catalog });
    });

    it('should replace its content when published', () => {
      expect(existing.textContent).toBe(
        JSON.stringify({ schemaVersion: '1', runtime, catalog }),
      );
    });

    it('should not append a new element when published', () => {
      expect(driver.get.appendMock()).not.toHaveBeenCalled();
    });
  });
});

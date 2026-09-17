/** @jest-environment jsdom */
import { faker } from '@faker-js/faker';
import { aHostCatalog, aHostRuntimeConfig } from '@atlas/testkit';
import { RuntimeSnapshotDriver } from './runtime-snapshot.driver.js';

describe('publishRuntimeSnapshot', () => {
  let driver: RuntimeSnapshotDriver;

  beforeEach(() => {
    driver = new RuntimeSnapshotDriver();
  });

  it('should append a JSON script element holding the snapshot when no snapshot element exists', () => {
    const runtime = aHostRuntimeConfig();
    const catalog = aHostCatalog();
    driver.when.published({ runtime, catalog });

    expect(driver.get.snapshotElements()).toEqual([
      {
        id: 'atlas-runtime-snapshot',
        type: 'application/json',
        textContent: JSON.stringify({ schemaVersion: '1', runtime, catalog }),
      },
    ]);
  });

  describe('when a snapshot element already exists', () => {
    const runtime = aHostRuntimeConfig();
    const catalog = aHostCatalog();

    beforeEach(() => {
      driver.given
        .existingSnapshotContent(faker.lorem.sentence())
        .when.published({ runtime, catalog });
    });

    it('should replace its content when published', () => {
      expect(driver.get.snapshotElements()[0]?.textContent).toBe(
        JSON.stringify({ schemaVersion: '1', runtime, catalog }),
      );
    });

    it('should not append a second element when published', () => {
      expect(driver.get.snapshotElements()).toHaveLength(1);
    });
  });
});

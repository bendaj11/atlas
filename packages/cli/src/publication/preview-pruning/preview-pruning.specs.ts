import { faker } from '@faker-js/faker';
import type { AtlasStaticRegistry } from '@atlas/schema';
import { createEmptyStaticRegistry } from '../static-registry/static-registry.js';
import { PreviewPruningDriver } from './preview-pruning.driver.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function isRegistryReferencing(
  appId: string,
  generation: string,
): AtlasStaticRegistry {
  return {
    ...createEmptyStaticRegistry(),
    apps: {
      [appId]: {
        id: appId,
        name: faker.commerce.productName(),
        releases: {},
        previews: {
          7: {
            path: `${generation}/manifest.json`,
            digest: 'sha256:x',
            size: 1,
          },
        },
      } as unknown as AtlasStaticRegistry['apps'][string],
    },
  };
}

describe('pruneUnreferencedPreviewGenerations', () => {
  let driver: PreviewPruningDriver;
  const appId = faker.string.uuid();
  const generation = `apps/${appId}/previews/7/abc`;

  beforeEach(() => {
    driver = new PreviewPruningDriver();
  });

  it('should remove every object of an unreferenced generation older than a day when pruned', async () => {
    driver.given
      .object(`${generation}/manifest.json`, 2 * DAY_MS)
      .given.object(`${generation}/main.js`, 2 * DAY_MS);

    await driver.when.pruned([
      { kind: 'app', id: appId, openPreviews: new Set() },
    ]);

    expect(driver.get.removedPaths()).toStrictEqual([
      `${generation}/manifest.json`,
      `${generation}/main.js`,
    ]);
  });

  it('should count one removal per generation when pruned', async () => {
    driver.given
      .object(`${generation}/manifest.json`, 2 * DAY_MS)
      .given.object(`${generation}/main.js`, 2 * DAY_MS);

    expect(
      await driver.when.pruned([
        { kind: 'app', id: appId, openPreviews: new Set() },
      ]),
    ).toBe(1);
  });

  it('should keep a generation the registry still references when pruned', async () => {
    driver.given
      .registry(isRegistryReferencing(appId, generation))
      .given.object(`${generation}/manifest.json`, 2 * DAY_MS);

    await driver.when.pruned([
      { kind: 'app', id: appId, openPreviews: new Set() },
    ]);

    expect(driver.get.removedPaths()).toStrictEqual([]);
  });

  it('should keep a generation modified within the grace period when pruned', async () => {
    driver.given.object(`${generation}/manifest.json`, DAY_MS / 2);

    await driver.when.pruned([
      { kind: 'app', id: appId, openPreviews: new Set() },
    ]);

    expect(driver.get.removedPaths()).toStrictEqual([]);
  });

  it('should ignore artifacts outside the given preview states when pruned', async () => {
    driver.given.object(`${generation}/manifest.json`, 2 * DAY_MS);

    await driver.when.pruned([
      { kind: 'app', id: faker.string.uuid(), openPreviews: new Set() },
    ]);

    expect(driver.get.removedPaths()).toStrictEqual([]);
  });
});

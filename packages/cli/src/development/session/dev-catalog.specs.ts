import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { anOverrideDocument } from '@atlas/testkit/internal';
import { createLocalDevCatalog } from './dev-catalog.js';

describe('createLocalDevCatalog', () => {
  it('should list an app once when several overrides carry its manifest', () => {
    const manifest = anAppManifest();

    expect(
      createLocalDevCatalog(
        anOverrideDocument({
          overrides: [
            { appId: manifest.id, manifest, reason: 'local' },
            { appId: faker.string.uuid(), manifest, reason: 'local' },
          ],
        }),
      ).apps,
    ).toStrictEqual([manifest]);
  });
});

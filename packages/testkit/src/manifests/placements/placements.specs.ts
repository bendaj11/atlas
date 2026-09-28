import { faker } from '@faker-js/faker';
import { validateAtlasManifest } from '@atlas/schema';
import { anAppManifest } from '../artifact-manifests/artifact-manifests.js';
import { aRoutePlacement, aSlotPlacement } from './placements.js';

describe('aRoutePlacement', () => {
  it('should build a schema-valid route placement when placed in an app manifest', () => {
    const manifest = anAppManifest({ placements: [aRoutePlacement()] });

    expect(validateAtlasManifest(manifest)).toEqual([]);
  });

  it('should merge route fields into the generated route when route fields are given', () => {
    const path = `/${faker.lorem.slug()}`;

    expect(aRoutePlacement({ route: { path } }).route?.path).toBe(path);
  });
});

describe('aSlotPlacement', () => {
  it('should build a schema-valid slot placement when placed in an app manifest', () => {
    const manifest = anAppManifest({ placements: [aSlotPlacement()] });

    expect(validateAtlasManifest(manifest)).toEqual([]);
  });
});

import { faker } from '@faker-js/faker';
import {
  validateAtlasHostManifest,
  validateAtlasManifest,
} from '@atlas/schema';
import { aRoutePlacement } from '../placements/placements.js';
import {
  aHostManifest,
  anAppManifest,
  anAppVersionOf,
} from './artifact-manifests.js';

describe('anAppManifest', () => {
  it('should build a schema-valid app manifest when built with defaults', () => {
    expect(validateAtlasManifest(anAppManifest())).toEqual([]);
  });

  it('should support each placement host once when placements share a host', () => {
    const hostId = faker.string.uuid();
    const placements = [
      aRoutePlacement({ hostId }),
      aRoutePlacement({ hostId }),
    ];

    expect(anAppManifest({ placements }).supportedHosts).toEqual([hostId]);
  });
});

describe('aHostManifest', () => {
  it('should build a schema-valid host manifest when built with defaults', () => {
    expect(validateAtlasHostManifest(aHostManifest())).toEqual([]);
  });
});

describe('anAppVersionOf', () => {
  it('should keep the app id when an app manifest is versioned', () => {
    const app = anAppManifest();

    expect(anAppVersionOf(app).id).toBe(app.id);
  });

  it('should keep the app name when an app manifest is versioned', () => {
    const app = anAppManifest();

    expect(anAppVersionOf(app).name).toBe(app.name);
  });

  it('should keep the supported hosts when an app manifest is versioned', () => {
    const app = anAppManifest();

    expect(anAppVersionOf(app).supportedHosts).toEqual(app.supportedHosts);
  });

  it('should apply the overrides when overrides are given', () => {
    const version = faker.system.semver();

    expect(anAppVersionOf(anAppManifest(), { version }).version).toBe(version);
  });
});

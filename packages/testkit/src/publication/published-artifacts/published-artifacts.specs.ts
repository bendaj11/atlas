import { faker } from '@faker-js/faker';
import {
  ATLAS_FRAMEWORKS,
  validatePublishedArtifactManifest,
} from '@atlas/schema';
import { aRoutePlacement } from '../../manifests/placements/placements.js';
import {
  aHostArtifactManifest,
  anAppArtifactManifest,
  aPublishedWidget,
} from './published-artifacts.js';

describe('anAppArtifactManifest', () => {
  it('should build a schema-valid app artifact manifest when built with defaults', () => {
    expect(validatePublishedArtifactManifest(anAppArtifactManifest())).toEqual(
      [],
    );
  });

  it('should support each placement host once when placements share a host', () => {
    const hostId = faker.string.uuid();
    const placements = [
      aRoutePlacement({ hostId }),
      aRoutePlacement({ hostId }),
    ];

    expect(anAppArtifactManifest({ placements }).supportedHosts).toEqual([
      hostId,
    ]);
  });
});

describe('aHostArtifactManifest', () => {
  it('should build a schema-valid host artifact manifest when built with defaults', () => {
    expect(validatePublishedArtifactManifest(aHostArtifactManifest())).toEqual(
      [],
    );
  });
});

describe('aPublishedWidget', () => {
  it('should build a schema-valid widget when exported by its owner app artifact with the same framework', () => {
    const id = faker.string.uuid();
    const framework = faker.helpers.arrayElement(ATLAS_FRAMEWORKS);
    const manifest = anAppArtifactManifest({
      id,
      framework,
      exportedWidgets: [aPublishedWidget({ ownerAppId: id, framework })],
    });

    expect(validatePublishedArtifactManifest(manifest)).toEqual([]);
  });
});

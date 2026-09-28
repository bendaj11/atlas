import { faker } from '@faker-js/faker';
import { ATLAS_FRAMEWORKS, validateAtlasManifest } from '@atlas/schema';
import { anAppManifest } from '../artifact-manifests/artifact-manifests.js';
import { anExportedWidgetManifest } from './exported-widgets.js';

describe('anExportedWidgetManifest', () => {
  it('should build a schema-valid widget when exported by its owner app with the same framework', () => {
    const id = faker.string.uuid();
    const framework = faker.helpers.arrayElement(ATLAS_FRAMEWORKS);
    const manifest = anAppManifest({
      id,
      framework,
      exportedWidgets: [
        anExportedWidgetManifest({ ownerAppId: id, framework }),
      ],
    });

    expect(validateAtlasManifest(manifest)).toEqual([]);
  });
});

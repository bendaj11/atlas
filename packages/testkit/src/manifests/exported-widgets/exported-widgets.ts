import { faker } from '@faker-js/faker';
import {
  ATLAS_FRAMEWORKS,
  type AtlasExportedWidgetManifest,
} from '@atlas/schema';

export function anExportedWidgetManifest(
  overrides: Partial<AtlasExportedWidgetManifest> = {},
): AtlasExportedWidgetManifest {
  return {
    schemaVersion: '1',
    contractVersion: '1',
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    ownerAppId: faker.string.uuid(),
    framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
    remoteEntryUrl: faker.internet.url(),
    expose: `./${faker.lorem.slug()}`,
    ...overrides,
  };
}

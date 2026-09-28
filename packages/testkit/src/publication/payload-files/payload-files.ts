import { faker } from '@faker-js/faker';
import {
  ATLAS_IMMUTABLE_CACHE_CONTROL,
  type AtlasManifestDescriptor,
  type AtlasPayloadFileDescriptor,
} from '@atlas/schema';
import { aRelativePath, aSha256Digest } from '../identifiers/identifiers.js';

export function aManifestDescriptor(
  overrides: Partial<AtlasManifestDescriptor> = {},
): AtlasManifestDescriptor {
  return {
    path: aRelativePath('json'),
    digest: aSha256Digest(),
    size: faker.number.int({ min: 1, max: 100_000 }),
    mediaType: 'application/json',
    ...overrides,
  };
}

export function aPayloadFileDescriptor(
  overrides: Partial<AtlasPayloadFileDescriptor> = {},
): AtlasPayloadFileDescriptor {
  return {
    path: aRelativePath('js'),
    digest: aSha256Digest(),
    size: faker.number.int({ min: 1, max: 100_000 }),
    mediaType: 'text/javascript; charset=utf-8',
    cacheControl: ATLAS_IMMUTABLE_CACHE_CONTROL,
    role: 'script',
    ...overrides,
  };
}

export function aRemoteEntryFile(
  overrides: Partial<AtlasPayloadFileDescriptor> = {},
): AtlasPayloadFileDescriptor {
  return aPayloadFileDescriptor({ role: 'remote-entry', ...overrides });
}

export function aStylesheetFile(
  overrides: Partial<AtlasPayloadFileDescriptor> = {},
): AtlasPayloadFileDescriptor {
  return aPayloadFileDescriptor({
    path: aRelativePath('css'),
    mediaType: 'text/css; charset=utf-8',
    role: 'stylesheet',
    ...overrides,
  });
}

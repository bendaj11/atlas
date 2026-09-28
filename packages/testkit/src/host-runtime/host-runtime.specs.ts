import { faker } from '@faker-js/faker';
import {
  validateAtlasHostCatalog,
  validateAtlasHostRuntimeConfig,
} from '@atlas/schema';
import { aHostManifest } from '../manifests/artifact-manifests/artifact-manifests.js';
import { aHostCatalog, aHostRuntimeConfig } from './host-runtime.js';

describe('aHostRuntimeConfig', () => {
  it('should build a schema-valid runtime config when built with defaults', () => {
    expect(validateAtlasHostRuntimeConfig(aHostRuntimeConfig())).toEqual([]);
  });
});

describe('aHostCatalog', () => {
  it('should build a schema-valid host catalog when built with defaults', () => {
    expect(validateAtlasHostCatalog(aHostCatalog())).toEqual([]);
  });

  it('should build the catalog host with the given host id when a host id is given', () => {
    const hostId = faker.string.uuid();

    expect(aHostCatalog({ hostId }).host.id).toBe(hostId);
  });

  it('should use the host manifest id as catalog host id when a host manifest is given', () => {
    const host = aHostManifest();

    expect(aHostCatalog({ host }).hostId).toBe(host.id);
  });
});

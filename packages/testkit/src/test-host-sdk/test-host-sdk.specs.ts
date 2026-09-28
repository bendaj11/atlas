import { faker } from '@faker-js/faker';
import { getAtlasNavigation } from '@atlas/sdk/host';
import { createTestHostSdk } from './test-host-sdk.js';

describe('createTestHostSdk', () => {
  it('should use the given host id when a host id is given', () => {
    const hostId = faker.string.uuid();

    expect(createTestHostSdk(hostId).hostId).toBe(hostId);
  });

  it('should register memory host navigation when created', () => {
    expect(
      getAtlasNavigation(createTestHostSdk()).getCurrentLocation().pathname,
    ).toBe('/');
  });
});

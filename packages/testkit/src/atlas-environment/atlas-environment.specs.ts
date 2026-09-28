import { faker } from '@faker-js/faker';
import { mockAtlasEnvironment } from './atlas-environment.js';

interface CustomerHostSdk {
  hostData: { user: { name: string } | null };
}

describe('mockAtlasEnvironment', () => {
  it('should share the sdk host id with the app context when created', () => {
    const { sdk, context } = mockAtlasEnvironment();

    expect(context?.hostId).toBe(sdk.hostId);
  });

  it('should start host navigation at the app path when no url is mocked', () => {
    const path = `/${faker.lorem.slug()}`;

    const { navigation } = mockAtlasEnvironment({ app: { path } });

    expect(navigation.getCurrentLocation().pathname).toBe(path);
  });

  it('should start host navigation at the mocked url when a url is mocked', () => {
    const url = `/${faker.lorem.slug()}/${faker.lorem.slug()}`;

    const { navigation } = mockAtlasEnvironment({ app: { url } });

    expect(navigation.getCurrentLocation().pathname).toBe(url);
  });

  it('should replace host data fields when host data is updated', () => {
    const user = { name: faker.person.firstName() };
    const environment = mockAtlasEnvironment<CustomerHostSdk>();

    environment.updateHostData({ user });

    expect(environment.sdk.hostData.user).toBe(user);
  });

  it('should report the app failure when the app reports a failure', () => {
    const error = new Error(faker.lorem.sentence());
    const environment = mockAtlasEnvironment();

    environment.context?.fail(error);

    expect(environment.failure()).toBe(error);
  });

  it('should report the app readiness when the app waits for readiness', () => {
    const environment = mockAtlasEnvironment();

    environment.context?.loading.waitUntilReady();

    expect(environment.isReady()).toBe(false);
  });

  describe('when the app is null', () => {
    it('should omit the app context when created', () => {
      expect(mockAtlasEnvironment({ app: null }).context).toBeUndefined();
    });

    it('should start host navigation at the root when created', () => {
      const { navigation } = mockAtlasEnvironment({ app: null });

      expect(navigation.getCurrentLocation().pathname).toBe('/');
    });

    it('should report ready when created', () => {
      expect(mockAtlasEnvironment({ app: null }).isReady()).toBe(true);
    });

    it('should report no failure when created', () => {
      expect(mockAtlasEnvironment({ app: null }).failure()).toBeUndefined();
    });

    it('should report the loader as hidden when created', () => {
      expect(mockAtlasEnvironment({ app: null }).isLoaderVisible()).toBe(false);
    });

    it('should report no tab title when created', () => {
      expect(mockAtlasEnvironment({ app: null }).tabTitle()).toBeUndefined();
    });
  });
});

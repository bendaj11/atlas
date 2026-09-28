import { faker } from '@faker-js/faker';
import { createMemoryNavigation } from '../../memory-navigation/memory-navigation.js';
import { createMockAppContext } from './mock-app-context.js';

describe('createMockAppContext', () => {
  it('should use the given host id when created', () => {
    const hostId = faker.string.uuid();

    const { context } = createMockAppContext({
      hostId,
      path: `/${faker.lorem.slug()}`,
      navigation: createMemoryNavigation(),
    });

    expect(context.hostId).toBe(hostId);
  });

  it('should build the app manifest from the mocked fields when the manifest is mocked', () => {
    const name = faker.commerce.productName();

    const { context } = createMockAppContext({
      hostId: faker.string.uuid(),
      path: `/${faker.lorem.slug()}`,
      navigation: createMemoryNavigation(),
      manifest: { name },
    });

    expect(context.manifest.name).toBe(name);
  });

  describe('when mounted at an app path', () => {
    const path = `/${faker.lorem.slug()}`;
    const innerPath = `/${faker.lorem.slug()}`;

    it('should expose the inner app route when the host url is inside the app path', () => {
      const { context } = createMockAppContext({
        hostId: faker.string.uuid(),
        path,
        navigation: createMemoryNavigation(`${path}${innerPath}`),
      });

      expect(context.route.getCurrent().pathname).toBe(innerPath);
    });

    it('should scope app navigation to the app path when the app navigates', () => {
      const navigation = createMemoryNavigation(path);
      const { context } = createMockAppContext({
        hostId: faker.string.uuid(),
        path,
        navigation,
      });

      context.navigation.navigate(innerPath);

      expect(navigation.getCurrentLocation().pathname).toBe(
        `${path}${innerPath}`,
      );
    });
  });

  describe('when created', () => {
    let appContext: ReturnType<typeof createMockAppContext>;

    beforeEach(() => {
      appContext = createMockAppContext({
        hostId: faker.string.uuid(),
        path: `/${faker.lorem.slug()}`,
        navigation: createMemoryNavigation(),
      });
    });

    it('should record the tab title when the app sets its tab title', () => {
      const title = faker.lorem.words();

      appContext.context.route.setTabTitle(title);

      expect(appContext.tabTitle()).toBe(title);
    });

    it('should report the loader as hidden when the app never shows the loader', () => {
      expect(appContext.isLoaderVisible()).toBe(false);
    });

    it('should report the loader as visible when the app shows the loader', () => {
      appContext.context.loading.show();

      expect(appContext.isLoaderVisible()).toBe(true);
    });

    it('should report the loader as hidden when the app hides the shown loader', () => {
      appContext.context.loading.show();

      appContext.context.loading.hide();

      expect(appContext.isLoaderVisible()).toBe(false);
    });

    it('should report no failure when the app never reports a failure', () => {
      expect(appContext.failure()).toBeUndefined();
    });

    it('should record the error when the app reports a failure', () => {
      const error = new Error(faker.lorem.sentence());

      appContext.context.fail(error);

      expect(appContext.failure()).toBe(error);
    });

    it('should report ready when the app never waits for readiness', () => {
      expect(appContext.isReady()).toBe(true);
    });

    it('should report not ready when the app waits for readiness', () => {
      appContext.context.loading.waitUntilReady();

      expect(appContext.isReady()).toBe(false);
    });

    it('should report ready when the app releases its readiness wait', () => {
      const ready = appContext.context.loading.waitUntilReady();

      ready();

      expect(appContext.isReady()).toBe(true);
    });

    it('should stay not ready when one of two readiness waits is released twice', () => {
      const ready = appContext.context.loading.waitUntilReady();
      appContext.context.loading.waitUntilReady();

      ready();
      ready();

      expect(appContext.isReady()).toBe(false);
    });
  });
});

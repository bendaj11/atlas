import { faker } from '@faker-js/faker';
import { updateAtlasHostData, type AtlasEventMap } from '@atlas/sdk/host';
import { createMemoryNavigation } from '../memory-navigation/memory-navigation.js';
import type {
  MockAtlasEnvironment,
  MockAtlasEnvironmentOverrides,
} from './atlas-environment.types.js';
import { createMockAppContext } from './mock-app-context/mock-app-context.js';
import { createMockSdk } from './mock-sdk/mock-sdk.js';

export function mockAtlasEnvironment<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
>(
  overrides: MockAtlasEnvironmentOverrides<THostSdk, TEvents> = {},
): MockAtlasEnvironment<THostSdk, TEvents> {
  const app = overrides.app === null ? undefined : (overrides.app ?? {});
  const path = app?.path ?? `/${faker.lorem.slug()}`;
  const navigation = createMemoryNavigation(app?.url ?? (app ? path : '/'));
  const sdk = createMockSdk<THostSdk, TEvents>({
    navigation,
    overrides: overrides.sdk ?? {},
  });
  const appContext =
    app &&
    createMockAppContext({
      hostId: sdk.hostId,
      path,
      navigation,
      manifest: app.manifest,
    });

  return {
    sdk,
    context: appContext?.context,
    navigation,
    updateHostData: (updates) => updateAtlasHostData(sdk, updates),
    tabTitle: () => appContext?.tabTitle(),
    isLoaderVisible: () => appContext?.isLoaderVisible() ?? false,
    isReady: () => appContext?.isReady() ?? true,
    failure: () => appContext?.failure(),
  };
}

import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasEventBus } from '../event-bus/index.js';
import type {
  AtlasGetWidget,
  AtlasGetWidgetOptions,
  AtlasNavigationState,
  AtlasSdk,
  AtlasSdkOptions,
  AtlasWidgetHandle,
} from '../sdk-types/index.js';
import type { AtlasNavigation } from '../../navigation/navigation-types/navigation-types.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import {
  connectAtlasNavigationResolver,
  connectAtlasWidgetResolver,
  createAtlasSdk,
  getAtlasNavigation,
} from './index.js';

interface CommerceHostSdk {
  hostData: { storeId: string };
  showToast(message: string): void;
}

type NavigationResolver = (appId: string, state?: AtlasNavigationState) => void;

export class SdkFactoryDriver {
  private readonly navigation = aMemoryNavigation();
  private readonly widgetResolver = jest.fn<AtlasGetWidget>();
  private readonly navigationResolver = jest.fn<NavigationResolver>();
  private options: AtlasSdkOptions<CommerceHostSdk> = {
    hostId: faker.string.uuid(),
    navigation: this.navigation,
    hostData: { storeId: faker.string.uuid() },
    showToast: jest.fn<CommerceHostSdk['showToast']>(),
  };
  private sdk!: AtlasSdk<CommerceHostSdk>;

  readonly given = {
    hostId: (hostId: string): this => {
      this.options = { ...this.options, hostId };

      return this;
    },
    hostData: (
      hostData: AtlasSdkOptions<CommerceHostSdk>['hostData'],
    ): this => {
      this.options = { ...this.options, hostData };

      return this;
    },
    showToast: (showToast: CommerceHostSdk['showToast']): this => {
      this.options = { ...this.options, showToast };

      return this;
    },
    eventBus: (eventBus: AtlasEventBus): this => {
      this.options = { ...this.options, eventBus };

      return this;
    },
    reservedProperty: (name: string, value: unknown): this => {
      this.options = { ...this.options, [name]: value };

      return this;
    },
    widgetHandle: (handle: AtlasWidgetHandle): this => {
      this.widgetResolver.mockReturnValue(handle);

      return this;
    },
  };

  readonly when = {
    sdkCreated: (): void => {
      this.sdk = createAtlasSdk<CommerceHostSdk>(this.options);
    },
    widgetResolverConnected: (): void => {
      connectAtlasWidgetResolver(this.sdk, this.widgetResolver);
    },
    navigationResolverConnected: (): void => {
      connectAtlasNavigationResolver(this.sdk, this.navigationResolver);
    },
    navigatedTo: (appId: string, state?: AtlasNavigationState): void => {
      this.sdk.navigateTo(appId, state);
    },
  };

  readonly get = {
    sdk: (): AtlasSdk<CommerceHostSdk> => this.sdk,
    widget: (
      widgetId: string,
      options?: AtlasGetWidgetOptions,
    ): AtlasWidgetHandle => this.sdk.getWidget(widgetId, options),
    widgetResolverMock: (): jest.Mock<AtlasGetWidget> => this.widgetResolver,
    navigationResolverMock: (): jest.Mock<NavigationResolver> =>
      this.navigationResolver,
    hostNavigation: (): AtlasNavigation => this.navigation,
    atlasNavigationOf: (sdk: object): AtlasNavigation =>
      getAtlasNavigation(sdk),
  };
}

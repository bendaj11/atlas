import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasEventBus } from '../event-bus/index.js';
import type {
  AtlasGetWidget,
  AtlasGetWidgetOptions,
  AtlasHostData,
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
  type NavigationResolver,
} from './index.js';

interface CommerceHostData {
  storeId: string;
}

type ShowToast = (message: string) => void;

interface CommerceHostSdk {
  hostData: CommerceHostData;
  showToast: ShowToast;
}

type CommerceHostDataOption = CommerceHostData & Partial<AtlasHostData>;

export class SdkFactoryDriver {
  private readonly navigation = aMemoryNavigation();
  private readonly widgetResolver = jest.fn<AtlasGetWidget>();
  private readonly navigationResolver = jest.fn<NavigationResolver>();
  private options: AtlasSdkOptions<CommerceHostSdk> = {
    hostId: faker.string.uuid(),
    navigation: this.navigation,
    hostData: { storeId: faker.string.uuid() },
    showToast: jest.fn<ShowToast>(),
  };
  private sdk!: AtlasSdk<CommerceHostSdk>;

  readonly given = {
    hostId: (hostId: string): this => {
      this.options = { ...this.options, hostId };

      return this;
    },
    hostData: (hostData: CommerceHostDataOption): this => {
      this.options = { ...this.options, hostData };

      return this;
    },
    showToast: (showToast: ShowToast): this => {
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
    widgetHandle: (handle: AtlasWidgetHandle<object>): this => {
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
    ): AtlasWidgetHandle<object> =>
      this.sdk.getWidget<object>(widgetId, options),
    widgetResolverMock: (): jest.Mock<AtlasGetWidget> => this.widgetResolver,
    navigationResolverMock: (): jest.Mock<NavigationResolver> =>
      this.navigationResolver,
    hostNavigation: (): AtlasNavigation => this.navigation,
    atlasNavigationOf: (sdk: object): AtlasNavigation =>
      getAtlasNavigation(sdk),
  };
}

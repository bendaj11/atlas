import type { AtlasManifest } from '@atlas/schema';
import type {
  AtlasEventBus,
  AtlasEventMap,
  AtlasGetWidget,
  AtlasHostData,
  AtlasHostDataOf,
  AtlasNavigationState,
  AtlasSdk,
} from '@atlas/sdk/host';
import type { AtlasAppContext } from '@atlas/sdk/lifecycle';
import type { AtlasNavigation } from '@atlas/sdk/navigation';

type CoreSdkKey = 'hostId' | 'hostData' | 'events' | 'navigateTo' | 'getWidget';

export type NavigateToApp = (
  appId: string,
  state?: AtlasNavigationState,
) => void;

export type MockAtlasHostData<THostSdk extends object> = Partial<
  AtlasHostData & AtlasHostDataOf<THostSdk>
>;

export type MockAtlasSdkOverrides<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
> = {
  hostId?: string;
  hostData?: MockAtlasHostData<THostSdk>;
  events?: AtlasEventBus<TEvents>;
  navigateTo?: NavigateToApp;
  getWidget?: AtlasGetWidget;
} & Partial<Omit<THostSdk, CoreSdkKey>>;

export interface MockAtlasAppOverrides {
  manifest?: Partial<AtlasManifest>;
  path?: string;
  url?: string;
}

export interface MockAtlasEnvironmentOverrides<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
> {
  sdk?: MockAtlasSdkOverrides<THostSdk, TEvents>;
  app?: MockAtlasAppOverrides | null;
}

export interface MockAtlasEnvironment<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
> {
  readonly sdk: AtlasSdk<THostSdk, TEvents>;
  readonly context: AtlasAppContext | undefined;
  readonly navigation: AtlasNavigation;
  updateHostData(updates: Partial<AtlasHostDataOf<THostSdk>>): void;
  tabTitle(): string | undefined;
  isLoaderVisible(): boolean;
  isReady(): boolean;
}

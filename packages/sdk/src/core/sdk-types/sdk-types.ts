import type { AtlasNavigation } from '../../navigation.js';
import type { AtlasEventBus, AtlasEventMap } from '../event-bus/index.js';
import type {
  AtlasHostData,
  AtlasHostDataOf,
  HostDataOptionOf,
} from './host-data-types.js';
import type { AtlasGetWidget } from './widget-types.js';

/** Values Atlas can safely carry between apps in the destination URL. */
export type AtlasNavigationState = Readonly<
  Record<string, string | number | boolean | null | undefined>
>;

/** Stable capabilities every host exposes to every mounted app and widget. */
export interface AtlasCoreSdk<
  THostData extends object = {},
  TEvents extends object = AtlasEventMap,
> {
  readonly hostId: string;
  readonly hostData: AtlasHostData & Readonly<THostData>;

  /** Navigate to a selected app or host headless app by its stable id. */
  navigateTo(appId: string, state?: AtlasNavigationState): void;

  /**
   * Typed, in-memory events shared by mounted apps in this host.
   * Use `emit()` to dispatch and `addEventListener()` / `removeEventListener()` for lifecycle-managed listeners.
   */
  readonly events: AtlasEventBus<TEvents>;

  /** Resolve one exported widget by globally unique widget id. */
  readonly getWidget: AtlasGetWidget;
}

/** Host-defined members of the SDK: everything except the core Atlas configuration keys. */
export type HostSdkProperties<THostSdk extends object> = Omit<
  THostSdk,
  'hostId' | 'hostData' | 'navigation' | 'eventBus' | 'events' | 'getWidget'
>;

/** Atlas runtime capabilities combined with a host-owned, consumer-typed API. */
export type AtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
> = AtlasCoreSdk<AtlasHostDataOf<THostSdk>, TEvents> &
  Readonly<HostSdkProperties<THostSdk>>;

export type AtlasSdkOptions<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
> = {
  hostId: string;
  navigation: AtlasNavigation;
  eventBus?: AtlasEventBus<TEvents>;
} & HostDataOptionOf<THostSdk> &
  HostSdkProperties<THostSdk>;

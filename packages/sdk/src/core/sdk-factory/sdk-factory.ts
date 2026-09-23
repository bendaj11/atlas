import { createAtlasEventBus, type AtlasEventMap } from '../event-bus/index.js';
import type {
  AtlasCoreSdk,
  AtlasHostDataOf,
  AtlasSdk,
  AtlasSdkOptions,
} from '../sdk-types/index.js';
import {
  assertPropertiesDoNotReplaceCore,
  buildHostData,
  pickHostDefinedProperties,
} from './sdk-properties.js';
import {
  registerHostNavigation,
  navigateThroughHost,
  resolveWidgetThroughHost,
} from './sdk-resolvers.js';

/** Creates the single host-owned SDK instance shared with mounted apps and widgets. */
export function createAtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
>(options: AtlasSdkOptions<THostSdk, TEvents>): AtlasSdk<THostSdk, TEvents> {
  const core = createAtlasCoreSdk(options);
  registerHostNavigation(core, options.navigation);

  const sdkProperties = pickHostDefinedProperties(options);
  assertPropertiesDoNotReplaceCore(sdkProperties, core);

  return Object.assign(core, sdkProperties) as AtlasSdk<THostSdk, TEvents>;
}

function createAtlasCoreSdk<THostSdk extends object, TEvents extends object>(
  options: AtlasSdkOptions<THostSdk, TEvents>,
): AtlasCoreSdk<AtlasHostDataOf<THostSdk>, TEvents> {
  const core: AtlasCoreSdk<AtlasHostDataOf<THostSdk>, TEvents> = {
    hostId: options.hostId,
    hostData: buildHostData(options),
    navigateTo: (appId, state) => navigateThroughHost(core, appId, state),
    events: options.eventBus ?? createAtlasEventBus<TEvents>(),
    getWidget: (widgetId, widgetOptions) =>
      resolveWidgetThroughHost(core, widgetId, widgetOptions),
  };

  return core;
}

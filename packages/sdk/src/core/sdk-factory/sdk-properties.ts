import type { AtlasHostData, AtlasSdkOptions } from '../sdk-types/index.js';
import { AtlasSdkError } from '../sdk-error/sdk-error.js';

export function buildHostData<THostSdk extends object, TEvents extends object>(
  options: AtlasSdkOptions<THostSdk, TEvents>,
): AtlasHostData & object {
  return {
    ...options.hostData,
    hostId: options.hostId,
    name: options.hostData?.name ?? options.hostId,
  };
}

/** Host-defined SDK members: everything in the options that is not core Atlas configuration. */
export function pickHostDefinedProperties<
  THostSdk extends object,
  TEvents extends object,
>(options: AtlasSdkOptions<THostSdk, TEvents>): object {
  const {
    hostId: _hostId,
    hostData: _hostData,
    navigation: _navigation,
    eventBus: _eventBus,
    ...sdkProperties
  } = options;

  return sdkProperties;
}

export function assertPropertiesDoNotReplaceCore(
  properties: object,
  core: object,
): void {
  const reservedName = Object.keys(properties).find((name) => name in core);

  if (!reservedName) return;

  throw new AtlasSdkError(
    `Atlas host SDK property "${reservedName}" conflicts with a core SDK capability.`,
    {
      suggestedActions: `Rename the custom "${reservedName}" property in the host SDK configuration, then restart the host.`,
      code: 'ATLAS_SDK_PROPERTY_CONFLICT',
    },
  );
}

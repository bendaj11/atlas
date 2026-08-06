import type {
  AtlasHostDataOf,
  AtlasHostDataValue,
  AtlasSdk,
} from './sdk-types.js';

type HostDataListener = () => void;

interface HostDataListenerRegistry {
  readonly listeners: Set<HostDataListener>;
}

const HOST_DATA_LISTENERS = Symbol.for('@atlas/sdk/host-data-listeners');

/** Replaces selected host-data fields and notifies every mounted app. Host-only API. */
export function updateAtlasHostData<THostSdk extends object>(
  sdk: AtlasSdk<THostSdk>,
  updates: Partial<AtlasHostDataOf<THostSdk>>,
): void {
  const updatedSdk = sdk as unknown as {
    hostData: AtlasHostDataValue<THostSdk>;
  };
  updatedSdk.hostData = { ...sdk.hostData, ...updates };
  for (const listener of readHostDataListeners(sdk)?.listeners ?? [])
    listener();
}

/** Subscribes to host-data updates. Framework adapters use this to refresh mounted apps. */
export function subscribeAtlasHostData(
  sdk: object,
  listener: HostDataListener,
): () => void {
  const { listeners } =
    readHostDataListeners(sdk) ?? createHostDataListeners(sdk);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readHostDataListeners(
  sdk: object,
): HostDataListenerRegistry | undefined {
  return (sdk as Record<symbol, HostDataListenerRegistry | undefined>)[
    HOST_DATA_LISTENERS
  ];
}

function createHostDataListeners(sdk: object): HostDataListenerRegistry {
  const registry: HostDataListenerRegistry = { listeners: new Set() };
  Object.defineProperty(sdk, HOST_DATA_LISTENERS, { value: registry });
  return registry;
}

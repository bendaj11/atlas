import { AtlasSdkError } from '../sdk-error/sdk-error.js';
import type { AtlasHostData } from '../sdk-types/index.js';

type HostDataListener = () => void;

interface HostDataListenerRegistry {
  readonly listeners: Set<HostDataListener>;
}

type ReadHostData<THostData extends AtlasHostData> = () => THostData;

/** Any SDK object carrying host data: the host SDK, or the `useAtlasSdk()` / `injectAtlasSdk()` facade over it. */
export interface AtlasHostDataSource<THostData extends AtlasHostData> {
  readonly hostData: THostData | ReadHostData<THostData>;
}

export type AtlasHostDataUpdates<THostData extends AtlasHostData> = Partial<
  Omit<THostData, keyof AtlasHostData>
>;

const HOST_DATA_LISTENERS = Symbol.for('@atlas/sdk/host-data-listeners');

/** Replaces selected host-data fields and notifies every mounted app. Host-only API. */
export function updateAtlasHostData<THostData extends AtlasHostData>(
  sdk: AtlasHostDataSource<THostData>,
  updates: AtlasHostDataUpdates<THostData>,
): void {
  const owner = findHostDataOwner(sdk);
  const hostData: THostData | ReadHostData<THostData> = Reflect.get(
    owner,
    'hostData',
  );

  if (
    typeof hostData === 'function' ||
    !Reflect.set(owner, 'hostData', { ...hostData, ...updates })
  ) {
    throw new AtlasSdkError('Atlas host data is not writable.', {
      suggestedActions: [
        'Call updateAtlasHostData with the Host SDK or the facade returned by useAtlasSdk() or injectAtlasSdk().',
        'Keep hostData a plain writable object on the Host SDK; do not freeze it or replace it with a signal or getter.',
      ],
      code: 'ATLAS_HOST_DATA_NOT_WRITABLE',
    });
  }

  for (const listener of getHostDataListeners(owner)?.listeners ?? []) {
    listener();
  }
}

/** Subscribes to host-data updates. Framework adapters use this to refresh mounted apps. */
export function subscribeAtlasHostData(
  sdk: object,
  listener: HostDataListener,
): () => void {
  const owner = findHostDataOwner(sdk);
  const { listeners } =
    getHostDataListeners(owner) ?? registerHostDataListeners(owner);
  listeners.add(listener);

  return () => listeners.delete(listener);
}

function getHostDataListeners(
  sdk: object,
): HostDataListenerRegistry | undefined {
  const registry: HostDataListenerRegistry | undefined = Reflect.get(
    sdk,
    HOST_DATA_LISTENERS,
  );

  return registry;
}

function registerHostDataListeners(sdk: object): HostDataListenerRegistry {
  const registry: HostDataListenerRegistry = { listeners: new Set() };
  Object.defineProperty(sdk, HOST_DATA_LISTENERS, { value: registry });

  return registry;
}

function findHostDataOwner(sdk: object): object {
  return findWritableHostDataIn(sdk) ?? sdk;
}

function findWritableHostDataIn(target: object | null): object | undefined {
  if (!target) return undefined;

  const descriptor = Reflect.getOwnPropertyDescriptor(target, 'hostData');

  if (descriptor?.writable && typeof descriptor.value !== 'function') {
    return target;
  }

  return findWritableHostDataIn(Reflect.getPrototypeOf(target));
}

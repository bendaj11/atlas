import { ensureActionableError } from "@atlas/schema";

export type AtlasEventMap = Record<string, unknown>;

export interface AtlasEventBus<TEvents extends object = AtlasEventMap> {
  publish<TKey extends keyof TEvents & string>(type: TKey, payload: TEvents[TKey]): void;
  subscribe<TKey extends keyof TEvents & string>(type: TKey, listener: (payload: TEvents[TKey]) => void): () => void;
  once<TKey extends keyof TEvents & string>(type: TKey, listener: (payload: TEvents[TKey]) => void): () => void;
}

type EventKey<TEvents extends object> = keyof TEvents & string;
type StoredEventListener<TEvents extends object> = (payload: TEvents[EventKey<TEvents>]) => void;

/** Creates an in-memory host-scoped bus. Listener failures do not block other subscribers. */
export function createAtlasEventBus<TEvents extends object = AtlasEventMap>(): AtlasEventBus<TEvents> {
  const listeners = new Map<EventKey<TEvents>, Set<StoredEventListener<TEvents>>>();

  function publish<TKey extends EventKey<TEvents>>(type: TKey, payload: TEvents[TKey]): void {
    for (const listener of listeners.get(type) ?? []) {
      notifyListener(listener, payload);
    }
  }

  function subscribe<TKey extends EventKey<TEvents>>(type: TKey, listener: (payload: TEvents[TKey]) => void): () => void {
    const subscribers = getOrCreateSubscribers(listeners, type);
    const storedListener = listener as StoredEventListener<TEvents>;
    subscribers.add(storedListener);
    return () => unsubscribe(listeners, type, storedListener);
  }

  function once<TKey extends EventKey<TEvents>>(type: TKey, listener: (payload: TEvents[TKey]) => void): () => void {
    let unsubscribeOnce: () => void = () => undefined;
    unsubscribeOnce = subscribe(type, (payload) => {
      unsubscribeOnce();
      listener(payload);
    });
    return unsubscribeOnce;
  }

  return { publish, subscribe, once };
}

function getOrCreateSubscribers<TEvents extends object>(
  listeners: Map<EventKey<TEvents>, Set<StoredEventListener<TEvents>>>,
  type: EventKey<TEvents>
): Set<StoredEventListener<TEvents>> {
  const subscribers = listeners.get(type) ?? new Set<StoredEventListener<TEvents>>();
  listeners.set(type, subscribers);
  return subscribers;
}

function notifyListener<TEvents extends object>(
  listener: StoredEventListener<TEvents>,
  payload: TEvents[EventKey<TEvents>]
): void {
  try {
    listener(payload);
  } catch (error) {
    queueMicrotask(() => {
      throw ensureActionableError(error, "Fix failing Atlas event listener named in stack trace, then publish event again.");
    });
  }
}

function unsubscribe<TEvents extends object>(
  listeners: Map<EventKey<TEvents>, Set<StoredEventListener<TEvents>>>,
  type: EventKey<TEvents>,
  listener: StoredEventListener<TEvents>
): void {
  const subscribers = listeners.get(type);
  subscribers?.delete(listener);
  if (subscribers?.size === 0) listeners.delete(type);
}

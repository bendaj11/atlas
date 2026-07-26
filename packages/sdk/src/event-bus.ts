import { AtlasError, errorSummary } from "@atlas/schema";

export type AtlasEventMap = Record<string, unknown>;

export interface AtlasEventBus<TEvents extends object = AtlasEventMap> {
  publish<TKey extends PayloadlessEventKey<TEvents>>(type: TKey): void;
  publish<TKey extends PayloadEventKey<TEvents>>(type: TKey, payload: TEvents[TKey]): void;
  subscribe<TKey extends keyof TEvents & string>(type: TKey, listener: (payload: TEvents[TKey]) => void): () => void;
  once<TKey extends keyof TEvents & string>(type: TKey, listener: (payload: TEvents[TKey]) => void): () => void;
}

type EventKey<TEvents extends object> = keyof TEvents & string;
type PayloadlessEventKey<TEvents extends object> = {
  [TKey in EventKey<TEvents>]: [TEvents[TKey]] extends [undefined] ? TKey : never;
}[EventKey<TEvents>];
type PayloadEventKey<TEvents extends object> = Exclude<EventKey<TEvents>, PayloadlessEventKey<TEvents>>;
type StoredEventListener<TEvents extends object> = (payload: TEvents[EventKey<TEvents>]) => void;

/** Creates an in-memory host-scoped bus. Listener failures do not block other subscribers. */
export function createAtlasEventBus<TEvents extends object = AtlasEventMap>(): AtlasEventBus<TEvents> {
  const listeners = new Map<EventKey<TEvents>, Set<StoredEventListener<TEvents>>>();

  function publish<TKey extends PayloadlessEventKey<TEvents>>(type: TKey): void;
  function publish<TKey extends PayloadEventKey<TEvents>>(type: TKey, payload: TEvents[TKey]): void;
  function publish(type: EventKey<TEvents>, payload?: TEvents[EventKey<TEvents>]): void {
    for (const listener of listeners.get(type) ?? []) {
      notifyListener(listener, payload as TEvents[EventKey<TEvents>]);
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
      const cause = error instanceof Error ? error : new Error(String(error));
      throw new AtlasError(`Atlas event listener failed: ${errorSummary(cause.message)}`, {
        suggestedActions: [
          "Use the stack trace to identify the failing event listener.",
          "Handle the listener failure or correct its input before publishing this event again."
        ],
        cause,
        code: "ATLAS_EVENT_LISTENER_FAILED",
        surface: "browser"
      });
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

import { AtlasError, errorSummary } from "@atlas/schema";

export type AtlasEventMap = Record<string, unknown>;

/**
 * Typed, in-memory event target scoped to one Atlas host.
 * Event names and payloads come from `TEvents`.
 */
export interface AtlasEventBus<TEvents extends object = AtlasEventMap> {
  /** Dispatch an event synchronously to listeners registered for its type. */
  emit<TKey extends PayloadlessEventKey<TEvents>>(type: TKey): void;
  emit<TKey extends PayloadEventKey<TEvents>>(type: TKey, payload: TEvents[TKey]): void;
  /** Register a listener. Remove it with the same function reference when its owner is destroyed. */
  addEventListener<TKey extends EventKey<TEvents>>(type: TKey, listener: AtlasEventListener<TEvents, TKey>): void;
  /** Remove a listener previously registered for this event type. */
  removeEventListener<TKey extends EventKey<TEvents>>(type: TKey, listener: AtlasEventListener<TEvents, TKey>): void;
  /** Register a listener that runs once, then removes itself. Returns a function that cancels it before dispatch. */
  once<TKey extends EventKey<TEvents>>(type: TKey, listener: AtlasEventListener<TEvents, TKey>): () => void;
}

type EventKey<TEvents extends object> = keyof TEvents & string;
type AtlasEventListener<TEvents extends object, TKey extends EventKey<TEvents>> = (payload: TEvents[TKey]) => void;
type PayloadlessEventKey<TEvents extends object> = {
  [TKey in EventKey<TEvents>]: [TEvents[TKey]] extends [undefined] ? TKey : never;
}[EventKey<TEvents>];
type PayloadEventKey<TEvents extends object> = Exclude<EventKey<TEvents>, PayloadlessEventKey<TEvents>>;
type StoredEventListener<TEvents extends object> = (payload: TEvents[EventKey<TEvents>]) => void;

/** Creates an in-memory host-scoped event target. Listener failures do not block other listeners. */
export function createAtlasEventBus<TEvents extends object = AtlasEventMap>(): AtlasEventBus<TEvents> {
  const listeners = new Map<EventKey<TEvents>, Set<StoredEventListener<TEvents>>>();

  function emit<TKey extends PayloadlessEventKey<TEvents>>(type: TKey): void;
  function emit<TKey extends PayloadEventKey<TEvents>>(type: TKey, payload: TEvents[TKey]): void;
  function emit(type: EventKey<TEvents>, payload?: TEvents[EventKey<TEvents>]): void {
    for (const listener of listeners.get(type) ?? []) {
      notifyListener(listener, payload as TEvents[EventKey<TEvents>]);
    }
  }

  function addEventListener<TKey extends EventKey<TEvents>>(type: TKey, listener: AtlasEventListener<TEvents, TKey>): void {
    const subscribers = getOrCreateSubscribers(listeners, type);
    const storedListener = listener as StoredEventListener<TEvents>;
    subscribers.add(storedListener);
  }

  function removeEventListener<TKey extends EventKey<TEvents>>(type: TKey, listener: AtlasEventListener<TEvents, TKey>): void {
    unsubscribe(listeners, type, listener as StoredEventListener<TEvents>);
  }

  function once<TKey extends EventKey<TEvents>>(type: TKey, listener: AtlasEventListener<TEvents, TKey>): () => void {
    const listenerOnce: AtlasEventListener<TEvents, TKey> = (payload) => {
      removeEventListener(type, listenerOnce);
      listener(payload);
    };
    addEventListener(type, listenerOnce);
    return () => removeEventListener(type, listenerOnce);
  }

  return { emit, addEventListener, removeEventListener, once };
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

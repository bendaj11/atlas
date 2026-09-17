export type AtlasEventMap = Record<string, unknown>;

export type EventKey<TEvents extends object> = keyof TEvents & string;

export type AtlasEventListener<
  TEvents extends object,
  TKey extends EventKey<TEvents>,
> = (payload: TEvents[TKey]) => void;

export type PayloadlessEventKey<TEvents extends object> = {
  [TKey in EventKey<TEvents>]: [TEvents[TKey]] extends [undefined]
    ? TKey
    : never;
}[EventKey<TEvents>];

export type PayloadEventKey<TEvents extends object> = Exclude<
  EventKey<TEvents>,
  PayloadlessEventKey<TEvents>
>;

export type StoredEventListener<TEvents extends object> = (
  payload: TEvents[EventKey<TEvents>],
) => void;

/**
 * Typed, in-memory event target scoped to one Atlas host.
 * Event names and payloads come from `TEvents`.
 */
export interface AtlasEventBus<TEvents extends object = AtlasEventMap> {
  /** Dispatch an event synchronously to listeners registered for its type. */
  emit<TKey extends PayloadlessEventKey<TEvents>>(type: TKey): void;
  emit<TKey extends PayloadEventKey<TEvents>>(
    type: TKey,
    payload: TEvents[TKey],
  ): void;

  /** Register a listener. Remove it with the same function reference when its owner is destroyed. */
  addEventListener<TKey extends EventKey<TEvents>>(
    type: TKey,
    listener: AtlasEventListener<TEvents, TKey>,
  ): void;

  /** Remove a listener previously registered for this event type. */
  removeEventListener<TKey extends EventKey<TEvents>>(
    type: TKey,
    listener: AtlasEventListener<TEvents, TKey>,
  ): void;

  /** Register a listener that runs once, then removes itself. Returns a function that cancels it before dispatch. */
  once<TKey extends EventKey<TEvents>>(
    type: TKey,
    listener: AtlasEventListener<TEvents, TKey>,
  ): () => void;
}

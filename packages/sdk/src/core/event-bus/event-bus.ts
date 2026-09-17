import type {
  AtlasEventBus,
  AtlasEventListener,
  AtlasEventMap,
  EventKey,
  PayloadEventKey,
  PayloadlessEventKey,
  StoredEventListener,
} from './event-bus.types.js';
import { ListenerRegistry } from './listener-registry.js';

/** Creates an in-memory host-scoped event target. Listener failures do not block other listeners. */
export function createAtlasEventBus<
  TEvents extends object = AtlasEventMap,
>(): AtlasEventBus<TEvents> {
  const registry = new ListenerRegistry<TEvents>();

  function emit<TKey extends PayloadlessEventKey<TEvents>>(type: TKey): void;
  function emit<TKey extends PayloadEventKey<TEvents>>(
    type: TKey,
    payload: TEvents[TKey],
  ): void;
  function emit(
    type: EventKey<TEvents>,
    payload?: TEvents[EventKey<TEvents>],
  ): void {
    registry.notify(type, payload as TEvents[EventKey<TEvents>]);
  }

  function addEventListener<TKey extends EventKey<TEvents>>(
    type: TKey,
    listener: AtlasEventListener<TEvents, TKey>,
  ): void {
    registry.add(type, listener as StoredEventListener<TEvents>);
  }

  function removeEventListener<TKey extends EventKey<TEvents>>(
    type: TKey,
    listener: AtlasEventListener<TEvents, TKey>,
  ): void {
    registry.remove(type, listener as StoredEventListener<TEvents>);
  }

  function once<TKey extends EventKey<TEvents>>(
    type: TKey,
    listener: AtlasEventListener<TEvents, TKey>,
  ): () => void {
    const listenerOnce: AtlasEventListener<TEvents, TKey> = (payload) => {
      removeEventListener(type, listenerOnce);
      listener(payload);
    };
    addEventListener(type, listenerOnce);

    return () => removeEventListener(type, listenerOnce);
  }

  return { emit, addEventListener, removeEventListener, once };
}

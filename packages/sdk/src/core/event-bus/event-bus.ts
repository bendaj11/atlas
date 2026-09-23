import type {
  AtlasEventBus,
  AtlasEventListener,
  AtlasEventMap,
  EventKey,
  PayloadEventKey,
  PayloadlessEventKey,
} from './event-bus.types.js';
import { EventListenerRegistry } from './listener-registry.js';

/** Creates an in-memory host-scoped event target. Listener failures do not block other listeners. */
export function createAtlasEventBus<
  TEvents extends object = AtlasEventMap,
>(): AtlasEventBus<TEvents> {
  const registry = new EventListenerRegistry<TEvents>();

  function emit<TKey extends PayloadlessEventKey<TEvents>>(type: TKey): void;
  function emit<TKey extends PayloadEventKey<TEvents>>(
    type: TKey,
    payload: TEvents[TKey],
  ): void;
  function emit(
    type: EventKey<TEvents>,
    payload?: TEvents[EventKey<TEvents>],
  ): void {
    registry.notify(type, payload);
  }

  function addEventListener<TKey extends EventKey<TEvents>>(
    type: TKey,
    listener: AtlasEventListener<TEvents, TKey>,
  ): void {
    registry.add(type, listener);
  }

  function removeEventListener<TKey extends EventKey<TEvents>>(
    type: TKey,
    listener: AtlasEventListener<TEvents, TKey>,
  ): void {
    registry.remove(type, listener);
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

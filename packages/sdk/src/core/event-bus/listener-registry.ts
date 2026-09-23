import { AtlasEventListenerError } from '../sdk-error/sdk-error.js';
import type { EventKey, StoredEventListener } from './event-bus.types.js';

/** Listeners keyed by event type; a type disappears when its last listener leaves. */
export class EventListenerRegistry<TEvents extends object> {
  private readonly listeners = new Map<
    EventKey<TEvents>,
    Set<StoredEventListener>
  >();

  add(type: EventKey<TEvents>, listener: StoredEventListener): void {
    const subscribers =
      this.listeners.get(type) ?? new Set<StoredEventListener>();
    this.listeners.set(type, subscribers);
    subscribers.add(listener);
  }

  remove(type: EventKey<TEvents>, listener: StoredEventListener): void {
    const subscribers = this.listeners.get(type);
    subscribers?.delete(listener);

    if (subscribers?.size === 0) this.listeners.delete(type);
  }

  /** Calls every listener; a throwing listener is reported asynchronously and does not block the others. */
  notify(type: EventKey<TEvents>, payload: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      notifyListenerSafely(listener, payload);
    }
  }
}

function notifyListenerSafely(
  listener: StoredEventListener,
  payload: unknown,
): void {
  try {
    Reflect.apply(listener, undefined, [payload]);
  } catch (error) {
    queueMicrotask(() => {
      throw new AtlasEventListenerError(error);
    });
  }
}

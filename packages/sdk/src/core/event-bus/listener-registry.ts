import { errorSummary } from '@atlas/schema';
import { sdkError } from '../sdk-error/sdk-error.js';
import type { EventKey, StoredEventListener } from './event-bus.types.js';

/** Listeners keyed by event type; a type disappears when its last listener leaves. */
export class EventListenerRegistry<TEvents extends object> {
  private readonly listeners = new Map<
    EventKey<TEvents>,
    Set<StoredEventListener<TEvents>>
  >();

  add(type: EventKey<TEvents>, listener: StoredEventListener<TEvents>): void {
    const subscribers =
      this.listeners.get(type) ?? new Set<StoredEventListener<TEvents>>();
    this.listeners.set(type, subscribers);
    subscribers.add(listener);
  }

  remove(
    type: EventKey<TEvents>,
    listener: StoredEventListener<TEvents>,
  ): void {
    const subscribers = this.listeners.get(type);
    subscribers?.delete(listener);

    if (subscribers?.size === 0) this.listeners.delete(type);
  }

  /** Calls every listener; a throwing listener is reported asynchronously and does not block the others. */
  notify(type: EventKey<TEvents>, payload: TEvents[EventKey<TEvents>]): void {
    for (const listener of this.listeners.get(type) ?? []) {
      notifyListener(listener, payload);
    }
  }
}

function notifyListener<TEvents extends object>(
  listener: StoredEventListener<TEvents>,
  payload: TEvents[EventKey<TEvents>],
): void {
  try {
    listener(payload);
  } catch (error) {
    queueMicrotask(() => {
      throw listenerFailedError(error);
    });
  }
}

function listenerFailedError(error: unknown): Error {
  const cause = error instanceof Error ? error : new Error(String(error));

  return sdkError(
    `Atlas event listener failed: ${errorSummary(cause.message)}`,
    {
      suggestedActions: [
        'Use the stack trace to identify the failing event listener.',
        'Handle the listener failure or correct its input before publishing this event again.',
      ],
      cause,
      code: 'ATLAS_EVENT_LISTENER_FAILED',
    },
  );
}

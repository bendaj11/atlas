import { jest } from '@jest/globals';
import { createAtlasEventBus } from './index.js';

interface OrderEvents {
  'orders.updated': { orderId: string };
  'session.expired': undefined;
}

type OrderListener = (payload: { orderId: string }) => void;

export class EventBusDriver {
  private readonly bus = createAtlasEventBus<OrderEvents>();
  private readonly listener = jest.fn<OrderListener>();
  private readonly deferredTasks: Array<() => void> = [];
  private cancelOnce: (() => void) | undefined;

  constructor() {
    globalThis.queueMicrotask = (task: () => void) => {
      this.deferredTasks.push(task);
    };
  }

  readonly given = {
    failingListener: (error: Error): this => {
      this.bus.addEventListener('orders.updated', () => {
        throw error;
      });

      return this;
    },
  };

  readonly when = {
    listenerAdded: (): void => {
      this.bus.addEventListener('orders.updated', this.listener);
    },
    listenerRemoved: (): void => {
      this.bus.removeEventListener('orders.updated', this.listener);
    },
    onceListenerAdded: (): void => {
      this.cancelOnce = this.bus.once('orders.updated', this.listener);
    },
    onceListenerCancelled: (): void => {
      this.cancelOnce?.();
    },
    orderUpdated: (orderId: string): void => {
      this.bus.emit('orders.updated', { orderId });
    },
  };

  readonly get = {
    listenerMock: (): jest.Mock<OrderListener> => this.listener,
    deferredFailure: (): unknown => {
      for (const task of this.deferredTasks) {
        try {
          task();
        } catch (error) {
          return error;
        }
      }

      return undefined;
    },
  };
}

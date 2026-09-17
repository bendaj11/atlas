import { jest } from '@jest/globals';
import { ATLAS_DEV_BRIDGE_MARKER } from '@atlas/schema';
import { requestDevelopmentSession } from './index.js';

export class DevelopmentSessionDriver {
  private bridgeMarkerPresent = false;
  private requestId!: string;
  private origin!: string;
  private reply: unknown;
  private listener: ((event: Event) => void) | undefined;
  private timeout: (() => void) | undefined;
  private pending!: Promise<unknown>;
  private result: unknown;
  private readonly postMessage = jest.fn<
    (message: unknown, origin: string) => void
  >(() => {
    if (this.reply !== undefined)
      this.listener?.({ data: this.reply } as MessageEvent);
  });
  private readonly removeEventListener = jest.fn();

  readonly given = {
    bridgeMarkerPresent: (present: boolean) => {
      this.bridgeMarkerPresent = present;

      return this;
    },
    requestId: (requestId: string) => {
      this.requestId = requestId;

      return this;
    },
    origin: (origin: string) => {
      this.origin = origin;

      return this;
    },
    bridgeReply: (reply: unknown) => {
      this.reply = reply;

      return this;
    },
  };

  readonly when = {
    requested: (hostId: string) => {
      this.pending = requestDevelopmentSession({
        hostId,
        dependencies: {
          document: {
            querySelector: (selector: string) =>
              this.bridgeMarkerPresent &&
              selector === `meta[name="${ATLAS_DEV_BRIDGE_MARKER}"]`
                ? ({} as Element)
                : null,
          },
          window: {
            addEventListener: (
              _type: string,
              listener: EventListenerOrEventListenerObject,
            ) => {
              this.listener = listener as (event: Event) => void;
            },
            removeEventListener: this.removeEventListener,
            postMessage: this.postMessage as Window['postMessage'],
          },
          origin: this.origin,
          requestId: () => this.requestId,
          scheduleTimeout: (operation) => {
            this.timeout = operation;

            return 1;
          },
          clearScheduledTimeout: () => {
            this.timeout = undefined;
          },
        },
      });
    },
    settled: async () => {
      this.result = await this.pending;
    },
    timedOut: async () => {
      this.timeout?.();
      this.result = await this.pending;
    },
  };

  readonly get = {
    result: () => this.result,
    postMessageMock: () => this.postMessage,
    removeEventListenerMock: () => this.removeEventListener,
  };
}

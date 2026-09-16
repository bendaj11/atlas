import { faker } from '@faker-js/faker';
import {
  ATLAS_DEV_BRIDGE_MARKER,
  ATLAS_DEV_SESSION_REQUEST,
  ATLAS_DEV_SESSION_RESPONSE,
  type AtlasDevelopmentSessionRequest,
} from '@atlas/schema';
import { requestDevelopmentSession } from './development-session.js';

export class DevelopmentSessionDriver {
  private readonly hostId = faker.string.uuid();
  private readonly requestId = faker.string.uuid();
  private readonly document = { hostId: this.hostId };
  private bridgeInstalled = false;
  private listener: ((event: Event) => void) | undefined;
  private timeout: (() => void) | undefined;
  private result: unknown;

  readonly given = {
    bridgeInstalled: (): DevelopmentSessionDriver => {
      this.bridgeInstalled = true;
      return this;
    },
    matchingResponse: (): DevelopmentSessionDriver => {
      this.bridgeInstalled = true;
      this.respond = (request) => {
        this.listener?.({
          data: {
            type: ATLAS_DEV_SESSION_RESPONSE,
            requestId: request.requestId,
            hostId: request.hostId,
            document: this.document,
          },
        } as MessageEvent);
      };
      return this;
    },
  };

  readonly when = {
    requested: async (): Promise<void> => {
      this.result = await requestDevelopmentSession(this.hostId, {
        document: {
          querySelector: (selector: string) =>
            this.bridgeInstalled &&
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
          removeEventListener: () => {
            this.listener = undefined;
          },
          postMessage: (message) =>
            this.respond(message as AtlasDevelopmentSessionRequest),
        },
        origin: faker.internet.url(),
        requestId: () => this.requestId,
        scheduleTimeout: (operation) => {
          this.timeout = operation;
          return 1;
        },
        clearScheduledTimeout: () => {
          this.timeout = undefined;
        },
      });
    },
    timedOut: async (): Promise<void> => {
      const pending = this.when.requested();
      this.timeout?.();
      await pending;
    },
  };

  readonly get = {
    document: (): unknown => this.document,
    result: (): unknown => this.result,
  };

  private respond(_request: AtlasDevelopmentSessionRequest): void {
    if (!this.bridgeInstalled) return;
    this.listener?.({
      data: {
        type: ATLAS_DEV_SESSION_REQUEST,
        requestId: faker.string.uuid(),
        hostId: this.hostId,
      },
    } as MessageEvent);
  }
}

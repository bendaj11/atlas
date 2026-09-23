import { faker } from '@faker-js/faker';
import {
  ATLAS_DEV_BRIDGE_MARKER,
  ATLAS_DEV_SESSION_REQUEST,
  ATLAS_DEV_SESSION_RESPONSE,
  type AtlasDevelopmentSessionRequest,
  type AtlasDevelopmentSessionResponse,
} from '@atlas/schema';
import { installWebPlatformGlobals } from '../../shared/web-platform.testkit.js';
import { requestDevelopmentSession } from './development-session.js';

installWebPlatformGlobals();

export class DevelopmentSessionDriver {
  private readonly hostId = faker.string.uuid();
  private readonly marker = document.head.appendChild(
    document.createElement('meta'),
  );
  private sessionDocument: unknown;
  private respond = true;
  private result: unknown;

  constructor() {
    this.marker.name = ATLAS_DEV_BRIDGE_MARKER;

    window.addEventListener('message', this.answerSessionRequest);
  }

  readonly given = {
    sessionDocument: (sessionDocument: unknown) => {
      this.sessionDocument = sessionDocument;

      return this;
    },
    bridgeMarker: (present: boolean) => {
      if (!present) this.marker.remove();

      return this;
    },
    bridgeResponding: (respond: boolean) => {
      this.respond = respond;

      return this;
    },
  };

  readonly when = {
    requested: async () => {
      this.result = await requestDevelopmentSession(this.hostId);
    },
  };

  readonly get = {
    result: () => this.result,
  };

  dispose(): void {
    window.removeEventListener('message', this.answerSessionRequest);
    this.marker.remove();
  }

  private readonly answerSessionRequest = (event: MessageEvent) => {
    if (!this.respond || !isSessionRequest(event.data)) return;

    const response: AtlasDevelopmentSessionResponse = {
      type: ATLAS_DEV_SESSION_RESPONSE,
      requestId: event.data.requestId,
      hostId: event.data.hostId,
      document: this.sessionDocument,
    };

    window.postMessage(response, location.origin);
  };
}

function isSessionRequest(
  value: unknown,
): value is AtlasDevelopmentSessionRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === ATLAS_DEV_SESSION_REQUEST
  );
}

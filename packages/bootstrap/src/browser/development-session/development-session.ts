import {
  ATLAS_DEV_BRIDGE_MARKER,
  ATLAS_DEV_SESSION_REQUEST,
  ATLAS_DEV_SESSION_RESPONSE,
  type AtlasDevelopmentSessionRequest,
  type AtlasDevelopmentSessionResponse,
} from '@atlas/schema';

import type { DevelopmentSessionBridgeDependencies } from './development-session.types.js';

const BRIDGE_TIMEOUT_MS = 2_000;

export function requestDevelopmentSession({
  hostId,
  dependencies,
}: {
  hostId: string;
  dependencies?: DevelopmentSessionBridgeDependencies;
}): Promise<unknown | undefined> {
  const bridge = dependencies ?? createBrowserBridgeDependencies();

  if (!bridge) return Promise.resolve(undefined);

  if (!bridge.document.querySelector(buildDevelopmentBridgeMarkerSelector())) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const requestId = bridge.requestId();

    const settle = (document?: unknown): void => {
      bridge.window.removeEventListener('message', receiveBridgeMessage);
      bridge.clearScheduledTimeout(timeout);
      resolve(document);
    };

    const receiveBridgeMessage = (event: Event): void => {
      const response = matchDevelopmentSessionResponse({
        message: (event as MessageEvent).data,
        requestId,
        hostId,
      });

      if (response) settle(response.document);
    };

    const timeout = bridge.scheduleTimeout(() => settle(), BRIDGE_TIMEOUT_MS);
    const request: AtlasDevelopmentSessionRequest = {
      type: ATLAS_DEV_SESSION_REQUEST,
      requestId,
      hostId,
    };

    bridge.window.addEventListener('message', receiveBridgeMessage);
    bridge.window.postMessage(request, bridge.origin);
  });
}

function buildDevelopmentBridgeMarkerSelector(): string {
  return `meta[name="${ATLAS_DEV_BRIDGE_MARKER}"]`;
}

function matchDevelopmentSessionResponse({
  message,
  requestId,
  hostId,
}: {
  message: unknown;
  requestId: string;
  hostId: string;
}): AtlasDevelopmentSessionResponse | undefined {
  if (typeof message !== 'object' || message === null) return undefined;

  const response = message as Partial<AtlasDevelopmentSessionResponse>;
  const matches =
    response.type === ATLAS_DEV_SESSION_RESPONSE &&
    response.requestId === requestId &&
    response.hostId === hostId &&
    response.error === undefined;

  return matches ? (response as AtlasDevelopmentSessionResponse) : undefined;
}

function createBrowserBridgeDependencies():
  DevelopmentSessionBridgeDependencies | undefined {
  const document = globalThis.document;
  const window = globalThis.window;

  if (!document || !window || !globalThis.location) return undefined;

  return {
    document,
    window,
    origin: globalThis.location.origin,
    requestId: () => crypto.randomUUID(),
    scheduleTimeout: (operation, milliseconds) =>
      window.setTimeout(operation, milliseconds),
    clearScheduledTimeout: (timeout) => window.clearTimeout(timeout),
  };
}

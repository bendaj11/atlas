import {
  ATLAS_DEV_BRIDGE_MARKER,
  ATLAS_DEV_SESSION_REQUEST,
  ATLAS_DEV_SESSION_RESPONSE,
  type AtlasDevelopmentSessionRequest,
  type AtlasDevelopmentSessionResponse,
} from '@atlas/schema';

const BRIDGE_TIMEOUT_MS = 2_000;

interface DevelopmentSessionBridgeDependencies {
  document: Pick<Document, 'querySelector'>;
  window: Pick<
    Window,
    'addEventListener' | 'removeEventListener' | 'postMessage'
  >;
  origin: string;
  requestId(): string;
  scheduleTimeout(operation: () => void, milliseconds: number): number;
  clearScheduledTimeout(timeout: number): void;
}

export function requestDevelopmentSession(
  hostId: string,
  dependencies?: DevelopmentSessionBridgeDependencies,
): Promise<unknown | undefined> {
  const bridge = dependencies ?? defaultDependencies();
  if (!bridge) return Promise.resolve(undefined);
  if (!bridge.document.querySelector(bridgeMarkerSelector())) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const requestId = bridge.requestId();
    const complete = (document?: unknown): void => {
      bridge.window.removeEventListener('message', receive);
      bridge.clearScheduledTimeout(timeout);
      resolve(document);
    };
    const receive = (event: Event): void => {
      const response = (event as MessageEvent).data;
      if (!isMatchingResponse(response, requestId, hostId)) return;
      complete(response.document);
    };
    const timeout = bridge.scheduleTimeout(() => complete(), BRIDGE_TIMEOUT_MS);
    const request: AtlasDevelopmentSessionRequest = {
      type: ATLAS_DEV_SESSION_REQUEST,
      requestId,
      hostId,
    };

    bridge.window.addEventListener('message', receive);
    bridge.window.postMessage(request, bridge.origin);
  });
}

function bridgeMarkerSelector(): string {
  return `meta[name="${ATLAS_DEV_BRIDGE_MARKER}"]`;
}

function isMatchingResponse(
  value: unknown,
  requestId: string,
  hostId: string,
): value is AtlasDevelopmentSessionResponse {
  if (typeof value !== 'object' || value === null) return false;
  const response = value as Partial<AtlasDevelopmentSessionResponse>;
  return (
    response.type === ATLAS_DEV_SESSION_RESPONSE &&
    response.requestId === requestId &&
    response.hostId === hostId &&
    response.error === undefined
  );
}

function defaultDependencies():
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

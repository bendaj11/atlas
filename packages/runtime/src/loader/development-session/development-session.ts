import {
  ATLAS_DEV_BRIDGE_MARKER,
  ATLAS_DEV_SESSION_REQUEST,
  ATLAS_DEV_SESSION_RESPONSE,
  type AtlasDevelopmentSessionRequest,
  type AtlasDevelopmentSessionResponse,
} from '@atlas/schema';

const BRIDGE_TIMEOUT_MS = 2_000;

export function requestDevelopmentSession(
  hostId: string,
): Promise<unknown | undefined> {
  const document = globalThis.document;
  const window = globalThis.window;
  if (
    !document?.querySelector(`meta[name="${ATLAS_DEV_BRIDGE_MARKER}"]`) ||
    !window
  ) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    const complete = (value?: unknown): void => {
      window.removeEventListener('message', receive);
      window.clearTimeout(timeout);
      resolve(value);
    };
    const receive = (event: MessageEvent): void => {
      if (!isMatchingResponse(event.data, requestId, hostId)) return;
      complete(event.data.document);
    };
    const timeout = window.setTimeout(() => complete(), BRIDGE_TIMEOUT_MS);
    const request: AtlasDevelopmentSessionRequest = {
      type: ATLAS_DEV_SESSION_REQUEST,
      requestId,
      hostId,
    };

    window.addEventListener('message', receive);
    window.postMessage(request, location.origin);
  });
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
    response.hostId === hostId
  );
}

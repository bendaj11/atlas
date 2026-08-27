import {
  ATLAS_DEV_BRIDGE_MARKER,
  ATLAS_DEV_SESSION_REQUEST,
  ATLAS_DEV_SESSION_RESPONSE,
  type AtlasDevelopmentSessionRequest,
  type AtlasDevelopmentSessionResponse,
} from '@atlas/schema';

const CONTROL_PORT_PARAMETER = 'atlas-dev-port';
const controlPort = readControlPort();
removeControlPortFromAddressBar();
installBridgeMarker();
window.addEventListener('message', relayDevelopmentSessionRequest);

function installBridgeMarker(): void {
  const marker = document.createElement('meta');
  marker.name = ATLAS_DEV_BRIDGE_MARKER;

  const append = (): boolean => {
    if (!document.documentElement) return false;
    document.documentElement.append(marker);
    return true;
  };
  if (append()) return;

  const observer = new MutationObserver(() => {
    if (!append()) return;
    observer.disconnect();
  });
  observer.observe(document, { childList: true });
}

function relayDevelopmentSessionRequest(event: MessageEvent): void {
  if (event.source !== window || !isDevelopmentSessionRequest(event.data)) {
    return;
  }
  const request = event.data;
  void chrome.runtime
    .sendMessage({
      type: 'atlas.load-development-session',
      hostId: request.hostId,
      previewUrl: location.href,
      ...(controlPort === undefined ? {} : { controlPort }),
    })
    .then(
      (response: unknown) => publishResponse(request, bridgeResponse(response)),
      (error: unknown) =>
        publishResponse(request, { error: messageFromError(error) }),
    );
}

function bridgeResponse(
  value: unknown,
): { document?: unknown; error?: string } | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const response = value as Record<string, unknown>;
  return {
    ...('document' in response ? { document: response.document } : {}),
    ...(typeof response.error === 'string' ? { error: response.error } : {}),
  };
}

function publishResponse(
  request: AtlasDevelopmentSessionRequest,
  response: { document?: unknown; error?: string } | undefined,
): void {
  const message: AtlasDevelopmentSessionResponse = {
    type: ATLAS_DEV_SESSION_RESPONSE,
    requestId: request.requestId,
    hostId: request.hostId,
    ...(response?.document !== undefined
      ? { document: response.document }
      : {}),
    ...(response?.error ? { error: response.error } : {}),
  };
  window.postMessage(message, location.origin);
}

function readControlPort(): number | undefined {
  const value = new URL(location.href).searchParams.get(CONTROL_PORT_PARAMETER);
  if (value === null) return undefined;
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65_535
    ? port
    : undefined;
}

function removeControlPortFromAddressBar(): void {
  const url = new URL(location.href);
  if (!url.searchParams.has(CONTROL_PORT_PARAMETER)) return;
  url.searchParams.delete(CONTROL_PORT_PARAMETER);
  history.replaceState(history.state, '', url.href);
}

function isDevelopmentSessionRequest(
  value: unknown,
): value is AtlasDevelopmentSessionRequest {
  if (typeof value !== 'object' || value === null) return false;
  const request = value as Partial<AtlasDevelopmentSessionRequest>;
  return (
    request.type === ATLAS_DEV_SESSION_REQUEST &&
    typeof request.requestId === 'string' &&
    typeof request.hostId === 'string'
  );
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

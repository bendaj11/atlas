import {
  ATLAS_DEV_ACTIVATION_PATH,
  ATLAS_DEV_ACTIVATION_PROTOCOL_VERSION,
  ATLAS_DEV_BRIDGE_MARKER,
  ATLAS_DEV_SESSION_REQUEST,
  ATLAS_DEV_SESSION_RESPONSE,
  type AtlasDevelopmentSessionRequest,
  type AtlasDevelopmentSessionResponse,
} from '@atlas/schema';

interface ConsumeDevelopmentSessionResponse {
  document?: unknown;
  error?: string;
}

installBridgeMarker();
window.addEventListener('message', relayDevelopmentSessionRequest);

if (
  isLoopbackHostname(location.hostname) &&
  location.pathname === ATLAS_DEV_ACTIVATION_PATH
) {
  void chrome.runtime
    .sendMessage({
      type: 'atlas.activate-development-preview',
      protocolVersion: ATLAS_DEV_ACTIVATION_PROTOCOL_VERSION,
    })
    .then(showActivationError, (error: unknown) =>
      renderActivationError(messageFromError(error)),
    );
}

function showActivationError(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  const error = (value as { error?: unknown }).error;
  if (typeof error === 'string') renderActivationError(error);
}

function renderActivationError(error: string): void {
  const main = document.querySelector('main');
  if (!main) return;
  const heading = document.createElement('h1');
  heading.textContent = 'Atlas could not start this preview';
  const message = document.createElement('p');
  message.textContent = error;
  main.replaceChildren(heading, message);
}

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
      type: 'atlas.consume-development-session',
      hostId: request.hostId,
    })
    .then(
      (response: unknown) => publishResponse(request, bridgeResponse(response)),
      (error: unknown) =>
        publishResponse(request, { error: messageFromError(error) }),
    );
}

function bridgeResponse(
  value: unknown,
): ConsumeDevelopmentSessionResponse | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const response = value as Record<string, unknown>;
  return {
    ...('document' in response ? { document: response.document } : {}),
    ...(typeof response.error === 'string' ? { error: response.error } : {}),
  };
}

function publishResponse(
  request: AtlasDevelopmentSessionRequest,
  response: ConsumeDevelopmentSessionResponse | undefined,
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

function isLoopbackHostname(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

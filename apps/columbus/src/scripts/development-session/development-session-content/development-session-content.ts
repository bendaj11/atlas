import {
  ATLAS_DEV_BRIDGE_MARKER,
  ATLAS_DEV_SESSION_REQUEST,
  ATLAS_DEV_SESSION_RESPONSE,
  type AtlasDevelopmentSessionRequest,
  type AtlasDevelopmentSessionResponse,
} from '@atlas/schema';
import {
  CONTROL_PORT_PARAMETER,
  parseControlPort,
  rememberControlPort,
  rememberedControlPort,
} from '../../../utils/control-port/control-port';
import { messageFromError } from '../../../utils/errors/errors';
import {
  isRecord,
  loadDevelopmentSessionRequest,
} from '../../../utils/messages/messages';

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
    .sendMessage(
      loadDevelopmentSessionRequest({
        hostId: request.hostId,
        previewUrl: location.href,
        ...(controlPort === undefined ? {} : { controlPort }),
      }),
    )
    .then(
      (response: unknown) => publishResponse(request, bridgeResponse(response)),
      (error: unknown) =>
        publishResponse(request, { error: messageFromError(error) }),
    );
}

function bridgeResponse(
  value: unknown,
): { document?: unknown; error?: string } | undefined {
  if (!isRecord(value)) return undefined;

  return {
    ...('document' in value ? { document: value.document } : {}),
    ...(typeof value.error === 'string' ? { error: value.error } : {}),
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
  const port = parseControlPort(
    new URL(location.href).searchParams.get(CONTROL_PORT_PARAMETER),
  );
  if (port === undefined) return rememberedControlPort();
  rememberControlPort(port);

  return port;
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
  if (!isRecord(value)) return false;
  const request = value as Partial<AtlasDevelopmentSessionRequest>;

  return (
    request.type === ATLAS_DEV_SESSION_REQUEST &&
    typeof request.requestId === 'string' &&
    typeof request.hostId === 'string'
  );
}

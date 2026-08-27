import {
  ATLAS_DEV_ACTIVATION_PATH,
  ATLAS_DEV_ACTIVATION_PROTOCOL_VERSION,
  ATLAS_DEV_ACTIVATION_TOKEN_PARAM,
  ATLAS_DEV_ACTIVATION_VERSION_PARAM,
  type AtlasDevelopmentActivationResponse,
} from '@atlas/schema';

const PENDING_ACTIVATION_KEY_PREFIX = 'atlas.pending-development-activation.';

interface PendingActivation {
  expiresAt: number;
  hostId: string;
  targetUrl: string;
  document: unknown;
}

interface ActivationDependencies {
  consumeActivation(url: string): Promise<unknown>;
  now(): number;
  store(key: string, value: PendingActivation): Promise<void>;
  navigate(tabId: number, url: string): Promise<void>;
}

const PENDING_ACTIVATION_LIFETIME_MS = 30_000;

interface ConsumptionDependencies {
  now(): number;
  read(key: string): Promise<unknown>;
  remove(key: string): Promise<void>;
}

export async function activateDevelopmentPreview(
  senderUrl: string,
  tabId: number,
  dependencies: ActivationDependencies,
): Promise<void> {
  const activationUrl = new URL(senderUrl);
  assertActivationOrigin(activationUrl);
  if (activationUrl.pathname !== ATLAS_DEV_ACTIVATION_PATH) {
    throw new Error('Atlas development activation path is invalid.');
  }

  const token = activationUrl.searchParams.get(
    ATLAS_DEV_ACTIVATION_TOKEN_PARAM,
  );
  const protocolVersion = activationUrl.searchParams.get(
    ATLAS_DEV_ACTIVATION_VERSION_PARAM,
  );
  if (!token || protocolVersion !== ATLAS_DEV_ACTIVATION_PROTOCOL_VERSION) {
    throw new Error('Atlas development activation parameters are missing.');
  }

  const consumeUrl = new URL(
    `${ATLAS_DEV_ACTIVATION_PATH}/${encodeURIComponent(token)}/consume`,
    activationUrl.origin,
  );
  const response = await dependencies.consumeActivation(consumeUrl.href);
  assertActivationResponse(response);
  const targetUrl = new URL(response.targetUrl);
  assertTargetUrl(targetUrl);
  const hostId = developmentSessionHostId(response.document);

  await dependencies.store(pendingActivationKey(tabId), {
    expiresAt: dependencies.now() + PENDING_ACTIVATION_LIFETIME_MS,
    hostId,
    targetUrl: targetUrl.href,
    document: response.document,
  });
  await dependencies.navigate(tabId, targetUrl.href);
}

export async function consumeDevelopmentSession(
  senderUrl: string,
  tabId: number,
  hostId: string,
  dependencies: ConsumptionDependencies,
): Promise<unknown | undefined> {
  const key = pendingActivationKey(tabId);
  const value = await dependencies.read(key);
  if (!isPendingActivation(value)) return undefined;
  await dependencies.remove(key);
  if (
    value.expiresAt <= dependencies.now() ||
    value.hostId !== hostId ||
    new URL(value.targetUrl).origin !== new URL(senderUrl).origin
  ) {
    return undefined;
  }

  return value.document;
}

function pendingActivationKey(tabId: number): string {
  return `${PENDING_ACTIVATION_KEY_PREFIX}${tabId}`;
}

function assertActivationOrigin(url: URL): void {
  if (url.protocol !== 'http:' || !isLoopbackHostname(url.hostname)) {
    throw new Error('Atlas development activation must use loopback HTTP.');
  }
}

function assertTargetUrl(url: URL): void {
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password
  ) {
    throw new Error('Atlas preview target URL is invalid.');
  }
}

function assertActivationResponse(
  value: unknown,
): asserts value is AtlasDevelopmentActivationResponse {
  if (
    !isRecord(value) ||
    value.protocolVersion !== ATLAS_DEV_ACTIVATION_PROTOCOL_VERSION ||
    typeof value.targetUrl !== 'string' ||
    !('document' in value)
  ) {
    throw new Error('Atlas development activation response is invalid.');
  }
}

function developmentSessionHostId(value: unknown): string {
  if (
    !isRecord(value) ||
    value.schemaVersion !== '1' ||
    typeof value.hostId !== 'string' ||
    !Array.isArray(value.overrides)
  ) {
    throw new Error('Atlas development session is invalid.');
  }
  return value.hostId;
}

function isPendingActivation(value: unknown): value is PendingActivation {
  return (
    isRecord(value) &&
    typeof value.expiresAt === 'number' &&
    typeof value.hostId === 'string' &&
    typeof value.targetUrl === 'string' &&
    'document' in value
  );
}

function isLoopbackHostname(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

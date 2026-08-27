const DEFAULT_CONTROL_PORT = 4_400;

interface DevelopmentSessionDependencies {
  fetchJson(url: string): Promise<unknown>;
}

export interface DevelopmentSessionRequest {
  controlPort?: number;
  hostId: string;
  previewUrl: string;
}

export async function loadDevelopmentSession(
  request: DevelopmentSessionRequest,
  dependencies: DevelopmentSessionDependencies,
): Promise<unknown> {
  const previewUrl = new URL(request.previewUrl);
  assertPreviewUrl(previewUrl);
  const controlPort = request.controlPort ?? DEFAULT_CONTROL_PORT;
  assertControlPort(controlPort);

  const sessionUrl = new URL(
    '/atlas.dev-session.json',
    `http://localhost:${controlPort}`,
  );
  sessionUrl.searchParams.set('hostId', request.hostId);
  sessionUrl.searchParams.set('previewUrl', previewUrl.href);
  const document = await dependencies.fetchJson(sessionUrl.href);
  assertDevelopmentSession(document, request.hostId);
  return document;
}

function assertPreviewUrl(url: URL): void {
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password
  ) {
    throw new Error('Atlas preview URL is invalid.');
  }
}

function assertControlPort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('Atlas development control port is invalid.');
  }
}

function assertDevelopmentSession(value: unknown, hostId: string): void {
  if (
    !isRecord(value) ||
    value.schemaVersion !== '1' ||
    value.hostId !== hostId ||
    !Array.isArray(value.overrides)
  ) {
    throw new Error('Atlas development session is invalid.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

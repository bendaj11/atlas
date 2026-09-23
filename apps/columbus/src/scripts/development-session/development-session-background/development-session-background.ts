import {
  DEFAULT_CONTROL_PORT,
  isControlPort,
} from '../../../utils/control-port/control-port';
import {
  isRecord,
  type LoadDevelopmentSessionRequest,
} from '../../../utils/messages/messages';

interface DevelopmentSessionDependencies {
  fetchJson(url: string): Promise<unknown>;
}

export type DevelopmentSessionRequest = Omit<
  LoadDevelopmentSessionRequest,
  'type'
>;

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
  if (!isControlPort(port)) {
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

const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNABORTED',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENETUNREACH',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);
const TRANSPORT_TIMEOUT_CODES = new Set([
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

export class ArtifactoryUnknownMutationOutcomeError extends Error {
  readonly publicationOutcomeUnknown = true;

  constructor() {
    super(
      'Artifactory mutation outcome is unknown; stop publishers and reconcile outstanding requests before retrying.',
    );
    this.name = 'ArtifactoryUnknownMutationOutcomeError';
  }
}

export class ArtifactoryHttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`Artifactory request returned HTTP ${status}.`);
    this.name = 'ArtifactoryHttpStatusError';
  }
}

export class ArtifactoryTransportError extends Error {
  declare readonly code?: string;

  constructor({
    message,
    error,
    signal,
  }: {
    message: string;
    error: unknown;
    signal: AbortSignal;
  }) {
    super(message);
    this.name = 'ArtifactoryTransportError';

    const code = isSyntaxError(error)
      ? undefined
      : (extractTransportFailureCode(error) ??
        (signal.aborted
          ? extractTransportFailureCode(signal.reason)
          : undefined));

    if (code) this.code = code;
  }
}

function isSyntaxError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'SyntaxError'
  );
}

function extractTransportFailureCode(error: unknown): string | undefined {
  const visited = new Set<object>();
  let failure = error;

  while (
    typeof failure === 'object' &&
    failure !== null &&
    !visited.has(failure)
  ) {
    visited.add(failure);

    if ('name' in failure && failure.name === 'TimeoutError')
      return 'ETIMEDOUT';

    const code = 'code' in failure ? failure.code : undefined;

    if (typeof code === 'string') {
      if (TRANSIENT_NETWORK_CODES.has(code)) return code;
      if (TRANSPORT_TIMEOUT_CODES.has(code)) return 'ETIMEDOUT';
    }

    failure = 'cause' in failure ? failure.cause : undefined;
  }

  return undefined;
}

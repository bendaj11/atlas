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

export function unknownMutationOutcome(): Error {
  return Object.assign(
    new Error(
      'Artifactory mutation outcome is unknown; stop publishers and reconcile outstanding requests before retrying.',
    ),
    { publicationOutcomeUnknown: true },
  );
}

export function httpStatusError(status: number): Error {
  return Object.assign(
    new Error(`Artifactory request returned HTTP ${status}.`),
    { status },
  );
}

export function transportError({
  message,
  error,
  signal,
}: {
  message: string;
  error: unknown;
  signal: AbortSignal;
}): Error {
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'SyntaxError'
  )
    return new Error(message);

  const code =
    transportFailureCode(error) ??
    (signal.aborted ? transportFailureCode(signal.reason) : undefined);

  return Object.assign(new Error(message), code ? { code } : {});
}

function transportFailureCode(error: unknown): string | undefined {
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

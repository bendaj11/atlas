import {
  httpStatusError,
  transportError,
  unknownMutationOutcome,
} from './artifactory-errors.js';

export function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Artifactory returned invalid storage information.');

  return value as Record<string, unknown>;
}

export function requireProperty(value: unknown): string {
  if (
    !Array.isArray(value) ||
    value.length !== 1 ||
    typeof value[0] !== 'string' ||
    !value[0].trim() ||
    /[\r\n\0]/.test(value[0])
  )
    throw new Error(
      'Artifactory requires single-valued publication metadata properties.',
    );

  return value[0];
}

export function requireSize(value: unknown): number {
  const size =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0)
    throw new Error('Artifactory returned an invalid file size.');

  return size;
}

export function lastModified(value: unknown): { lastModified?: string } {
  if (value === undefined) return {};

  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    throw new Error('Artifactory returned an invalid file timestamp.');

  return { lastModified: value };
}

export async function readJsonBody({
  response,
  signal,
}: {
  response: Response;
  signal: AbortSignal;
}): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw transportError({
      message: 'Artifactory returned an unreadable JSON response.',
      error,
      signal,
    });
  }
}

export async function requireStatus({
  response,
  accepted,
}: {
  response: Response;
  accepted: readonly number[];
}): Promise<void> {
  if (accepted.includes(response.status)) return;

  await discardResponse(response);

  throw httpStatusError(response.status);
}

export async function requireMutationStatus({
  response,
  accepted,
}: {
  response: Response;
  accepted: readonly number[];
}): Promise<void> {
  if (accepted.includes(response.status)) return;

  if (
    response.status === 408 ||
    response.status === 425 ||
    response.status === 429 ||
    response.status >= 500
  ) {
    await discardResponse(response);

    throw unknownMutationOutcome();
  }

  await requireStatus({ response, accepted });
}

export async function discardResponse(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    return;
  }
}

export async function downloadResponse({
  response,
  signal,
}: {
  response: Response;
  signal: AbortSignal;
}): Promise<AsyncIterable<Uint8Array> | undefined> {
  if (response.status === 404) {
    await discardResponse(response);

    return undefined;
  }

  await requireStatus({ response, accepted: [200] });

  if (!response.body) throw new Error('Artifactory download returned no body.');

  return readBody({ body: response.body, signal });
}

async function* readBody({
  body,
  signal,
}: {
  body: ReadableStream<Uint8Array>;
  signal: AbortSignal;
}): AsyncIterable<Uint8Array> {
  const reader = body.getReader();
  let completed = false;

  try {
    while (true) {
      const chunk = await reader.read();

      if (chunk.done) {
        completed = true;

        return;
      }

      yield chunk.value;
    }
  } catch (error) {
    throw transportError({
      message: 'Artifactory download stream failed.',
      error,
      signal,
    });
  } finally {
    try {
      if (!completed) await reader.cancel();
    } catch {
      completed = true;
    }

    reader.releaseLock();
  }
}

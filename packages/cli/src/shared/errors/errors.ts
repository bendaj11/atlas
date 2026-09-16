export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function httpStatusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('$metadata' in error) {
    const status = (error as { $metadata?: { httpStatusCode?: unknown } })
      .$metadata?.httpStatusCode;
    if (typeof status === 'number') return status;
  }
  if ('status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }

  return undefined;
}

export function errorCauseOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'cause' in error
    ? (error as { cause?: unknown }).cause
    : undefined;
}

import { AtlasError, type AtlasErrorOptions } from '@atlas/schema';

export interface AtlasRuntimeErrorOptions {
  code: string;
  suggestedActions: string | readonly string[];
  cause?: unknown;
  retryable?: boolean;
}

export class AtlasRuntimeError extends AtlasError {
  readonly retryable: boolean;

  constructor(summary: string, options: AtlasRuntimeErrorOptions) {
    super(summary, {
      suggestedActions: options.suggestedActions,
      ...(options.cause !== undefined ? { cause: options.cause } : {}),
      code: options.code,
      surface: 'browser',
    });
    this.name = 'AtlasRuntimeError';
    this.retryable = options.retryable ?? true;
  }
}

export interface AtlasBrowserErrorContext {
  summary: string;
  suggestedActions: string | readonly string[];
  code: string;
}

/** Adds browser-facing context to any failure while keeping an inner Atlas error's code and recovery steps. */
export class AtlasBrowserError extends AtlasError {
  constructor(failure: unknown, context: AtlasBrowserErrorContext) {
    super(...describeBrowserFailure(failure, context));

    this.name = 'AtlasBrowserError';
  }
}

function describeBrowserFailure(
  failure: unknown,
  context: AtlasBrowserErrorContext,
): [string, AtlasErrorOptions] {
  if (failure instanceof AtlasError) {
    return [
      `${context.summary}: ${failure.summary}`,
      {
        suggestedActions: failure.suggestedActions,
        cause: failure,
        code: failure.code ?? context.code,
        surface: 'browser',
      },
    ];
  }
  const cause = convertToError(failure);

  return [
    `${context.summary}: ${cause.message}`,
    {
      suggestedActions: context.suggestedActions,
      cause,
      code: context.code,
      surface: 'browser',
    },
  ];
}

export function logBrowserError(label: string, error: AtlasError): void {
  console.error(label, {
    message: error.summary,
    suggestedActions: error.suggestedActions,
    code: error.code,
    cause: error.cause,
  });
}

export function convertToError(failure: unknown): Error {
  return failure instanceof Error ? failure : new Error(String(failure));
}

export function extractErrorMessage(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}

export function isRetryableFailure(failure: unknown): boolean {
  return !(failure instanceof AtlasRuntimeError) || failure.retryable;
}

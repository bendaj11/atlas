import { AtlasError, errorSummary } from '@atlas/schema';

export interface AtlasSdkErrorOptions {
  readonly suggestedActions: string | readonly string[];
  readonly code: string;
  readonly cause?: unknown;
}

/** Public SDK misuse or an unavailable capability, reported in the browser. */
export class AtlasSdkError extends AtlasError {
  constructor(summary: string, options: AtlasSdkErrorOptions) {
    super(summary, {
      suggestedActions: options.suggestedActions,
      ...(options.cause !== undefined ? { cause: options.cause } : {}),
      code: options.code,
      surface: 'browser',
    });
    this.name = 'AtlasSdkError';
  }
}

/** A host widget failed to mount into its React container. */
export class AtlasWidgetMountError extends AtlasSdkError {
  constructor(widgetId: string, cause: unknown) {
    const failure = toError(cause);

    super(
      `Atlas widget "${widgetId}" failed to mount: ${errorSummary(failure.message)}`,
      {
        suggestedActions: [
          'Check that the widget id exists in the host catalog and that its owner app is deployed.',
          'Wrap the widget in an error boundary to render a fallback while the owner app is unavailable.',
        ],
        cause: failure,
        code: 'ATLAS_WIDGET_MOUNT_FAILED',
      },
    );
    this.name = 'AtlasWidgetMountError';
  }
}

/** An event listener threw while the host event bus was dispatching. */
export class AtlasEventListenerError extends AtlasSdkError {
  constructor(cause: unknown) {
    const failure = toError(cause);

    super(`Atlas event listener failed: ${errorSummary(failure.message)}`, {
      suggestedActions: [
        'Use the stack trace to identify the failing event listener.',
        'Handle the listener failure or correct its input before publishing this event again.',
      ],
      cause: failure,
      code: 'ATLAS_EVENT_LISTENER_FAILED',
    });
    this.name = 'AtlasEventListenerError';
  }
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

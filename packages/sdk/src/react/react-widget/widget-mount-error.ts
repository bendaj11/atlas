import { errorSummary, type AtlasError } from '@atlas/schema';
import { sdkError } from '../../core/sdk-error/sdk-error.js';

/** Wraps a failed widget mount so an error boundary can name the widget and its cause. */
export function widgetMountError(widgetId: string, error: unknown): AtlasError {
  const cause = error instanceof Error ? error : new Error(String(error));

  return sdkError(
    `Atlas widget "${widgetId}" failed to mount: ${errorSummary(cause.message)}`,
    {
      suggestedActions: [
        'Check that the widget id exists in the host catalog and that its owner app is deployed.',
        'Wrap the widget in an error boundary to render a fallback while the owner app is unavailable.',
      ],
      cause,
      code: 'ATLAS_WIDGET_MOUNT_FAILED',
    },
  );
}

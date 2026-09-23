import {
  AtlasEventListenerError,
  AtlasSdkError,
  AtlasWidgetMountError,
} from './sdk-error.js';

export class SdkErrorDriver {
  private error!: AtlasSdkError;

  readonly when = {
    sdkErrorCreated: (summary: string, code: string): void => {
      this.error = new AtlasSdkError(summary, {
        suggestedActions: 'Fix the call site.',
        code,
      });
    },
    sdkErrorCreatedWithCause: (summary: string, cause: unknown): void => {
      this.error = new AtlasSdkError(summary, {
        suggestedActions: 'Fix the call site.',
        code: 'ATLAS_SDK_FAILED',
        cause,
      });
    },
    widgetMountErrorCreated: (widgetId: string, cause: unknown): void => {
      this.error = new AtlasWidgetMountError(widgetId, cause);
    },
    eventListenerErrorCreated: (cause: unknown): void => {
      this.error = new AtlasEventListenerError(cause);
    },
  };

  readonly get = {
    error: (): AtlasSdkError => this.error,
    cause: (): unknown => this.error.cause,
  };
}

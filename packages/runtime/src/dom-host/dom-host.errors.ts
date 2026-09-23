import { AtlasBrowserError, AtlasRuntimeError } from '../shared/errors.js';

export class AtlasHostStartError extends AtlasBrowserError {
  constructor(cause: unknown) {
    super(cause, {
      summary: 'Atlas could not start this page',
      suggestedActions: [
        'Check the first failed URL or configuration value in the error details.',
        'Correct the host deployment metadata, then reload the page.',
      ],
      code: 'ATLAS_HOST_START_FAILED',
    });
    this.name = 'AtlasHostStartError';
  }
}

export class AtlasHostRetryError extends AtlasBrowserError {
  constructor(cause: unknown) {
    super(cause, {
      summary: 'Atlas could not restart this page',
      suggestedActions: [
        'Check the first failed URL or configuration value in the error details.',
        'Correct the deployment metadata, then reload the page.',
      ],
      code: 'ATLAS_HOST_RETRY_FAILED',
    });
    this.name = 'AtlasHostRetryError';
  }
}

export class AtlasAppLoadError extends AtlasBrowserError {
  constructor(appId: string, cause: unknown) {
    super(cause, {
      summary: `Atlas could not load app "${appId}"`,
      suggestedActions:
        'Correct the app build or host catalog, then use Retry in the page.',
      code: 'ATLAS_APP_LOAD_FAILED',
    });
    this.name = 'AtlasAppLoadError';
  }
}

export class AtlasSlotNameMissingError extends AtlasRuntimeError {
  constructor() {
    super('Atlas slot anchors require a name.', {
      code: 'ATLAS_SLOT_NAME_MISSING',
      suggestedActions: 'Pass a slotId to every AtlasSlot anchor.',
      retryable: false,
    });
    this.name = 'AtlasSlotNameMissingError';
  }
}

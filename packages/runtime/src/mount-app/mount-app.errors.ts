import { AtlasBrowserError, AtlasRuntimeError } from '../shared/errors.js';

export class AtlasStyleTargetMissingError extends AtlasRuntimeError {
  constructor(boundaryId: string) {
    super(
      `Atlas could not determine a style target for "${boundaryId}" because its container is not attached to a document.`,
      {
        code: 'ATLAS_STYLE_TARGET_MISSING',
        suggestedActions:
          'Mount Atlas apps and widgets into an element that belongs to a document with a <head>.',
        retryable: false,
      },
    );
    this.name = 'AtlasStyleTargetMissingError';
  }
}

export class AtlasAppMountError extends AtlasBrowserError {
  constructor(appId: string, cause: unknown) {
    super(cause, {
      summary: `Atlas could not mount app "${appId}"`,
      suggestedActions: [
        'Verify the app remote entry, federation metadata, and host placement configuration.',
        'Correct the app build or catalog entry, then retry loading the app.',
      ],
      code: 'ATLAS_APP_MOUNT_FAILED',
    });
    this.name = 'AtlasAppMountError';
  }
}

export class AtlasAppFailedError extends AtlasBrowserError {
  constructor(appId: string, cause: unknown) {
    super(cause, {
      summary: `Atlas app "${appId}" reported an unrecoverable failure`,
      suggestedActions: [
        'Check the browser console for the error the app reported.',
        'Fix the app, then retry loading it.',
      ],
      code: 'ATLAS_APP_FAILED',
    });
    this.name = 'AtlasAppFailedError';
  }
}

export class AtlasAppMountTimeoutError extends AtlasRuntimeError {
  constructor(summary: string) {
    super(summary, {
      code: 'ATLAS_APP_MOUNT_TIMEOUT',
      suggestedActions:
        'Check the app remote for a slow or hanging mount handler, or raise resourcesTimeoutMs in the host runtime configuration.',
    });
    this.name = 'AtlasAppMountTimeoutError';
  }
}

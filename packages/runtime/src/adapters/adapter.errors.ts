import { AtlasRuntimeError } from '../shared/errors.js';

export class AtlasSdkNotReadyError extends AtlasRuntimeError {
  constructor() {
    super('Atlas SDK is unavailable until the Angular host runtime starts.', {
      code: 'ATLAS_SDK_NOT_READY',
      suggestedActions:
        'Inject the Atlas SDK lazily (for example inside a handler or effect) instead of during host bootstrap.',
      retryable: false,
    });
    this.name = 'AtlasSdkNotReadyError';
  }
}

export class AtlasHostProviderMissingError extends AtlasRuntimeError {
  constructor() {
    super('Atlas host anchors must be rendered inside AtlasHostProvider.', {
      code: 'ATLAS_HOST_PROVIDER_MISSING',
      suggestedActions:
        'Wrap AtlasHostLayout, AtlasSlot, AtlasNavigation, AtlasRouteOutlet, and AtlasHostStatus in AtlasHostProvider.',
      retryable: false,
    });
    this.name = 'AtlasHostProviderMissingError';
  }
}

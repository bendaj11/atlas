import { AtlasBrowserError, AtlasRuntimeError } from '../shared/errors.js';

export class AtlasWidgetNotFoundError extends AtlasRuntimeError {
  constructor(widgetId: string) {
    super(
      `Atlas could not find widget "${widgetId}" in the active environment manifest.`,
      {
        code: 'ATLAS_WIDGET_NOT_FOUND',
        suggestedActions:
          'Deploy its provider app to this environment and retry.',
        retryable: false,
      },
    );
    this.name = 'AtlasWidgetNotFoundError';
  }
}

export class AtlasWidgetAmbiguousError extends AtlasRuntimeError {
  constructor(widgetId: string) {
    super(`Atlas found widget "${widgetId}" in more than one provider app.`, {
      code: 'ATLAS_WIDGET_AMBIGUOUS',
      suggestedActions: 'Give every exported widget a globally unique UUID.',
      retryable: false,
    });
    this.name = 'AtlasWidgetAmbiguousError';
  }
}

export class AtlasWidgetIdInvalidError extends AtlasRuntimeError {
  constructor() {
    super('Atlas widget id cannot be empty.', {
      code: 'ATLAS_WIDGET_ID_INVALID',
      suggestedActions: 'Pass the UUID from the exported widget manifest.',
      retryable: false,
    });
    this.name = 'AtlasWidgetIdInvalidError';
  }
}

export class AtlasWidgetResolverMissingError extends AtlasRuntimeError {
  constructor(widgetId: string) {
    super(
      `Atlas cannot load widget "${widgetId}" because no widget resolver is configured and the widget is not already known.`,
      {
        code: 'ATLAS_WIDGET_RESOLVER_MISSING',
        suggestedActions:
          'Configure the host SDK with createRegistryWidgetResolver, or register the widget before calling getWidget.',
        retryable: false,
      },
    );
    this.name = 'AtlasWidgetResolverMissingError';
  }
}

export class AtlasWidgetRemoteMismatchError extends AtlasRuntimeError {
  constructor(widgetReference: string) {
    super(
      `Atlas blocked widget "${widgetReference}" because its remote entry does not match the owning app manifest.`,
      {
        code: 'ATLAS_WIDGET_REMOTE_MISMATCH',
        suggestedActions:
          'Correct the widget remoteEntryUrl in the published manifest so it matches the owning app remote entry.',
        retryable: false,
      },
    );
    this.name = 'AtlasWidgetRemoteMismatchError';
  }
}

export class AtlasWidgetMountError extends AtlasBrowserError {
  constructor(widgetId: string, cause: unknown) {
    super(cause, {
      summary: `Atlas could not mount widget "${widgetId}"`,
      suggestedActions: [
        'Verify the widget ID, owner app manifest, remote entry, and exported mount function.',
        'Correct and republish the widget owner app, then retry loading the widget.',
      ],
      code: 'ATLAS_WIDGET_MOUNT_FAILED',
    });
    this.name = 'AtlasWidgetMountError';
  }
}

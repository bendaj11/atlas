import { AtlasRuntimeError } from '../shared/errors.js';

export class AtlasRuntimeConfigurationError extends AtlasRuntimeError {
  constructor(summary: string, cause?: unknown) {
    super(summary, {
      code: 'ATLAS_INVALID_RUNTIME_CONFIG',
      suggestedActions:
        'Correct the named host runtime configuration, redeploy it, then reload the page.',
      ...(cause !== undefined ? { cause } : {}),
      retryable: false,
    });
    this.name = 'AtlasRuntimeConfigurationError';
  }
}

export class AtlasCatalogSelectionError extends AtlasRuntimeError {
  constructor(summary: string) {
    super(summary, {
      code: 'ATLAS_INVALID_CATALOG_SELECTION',
      suggestedActions:
        'Correct the host catalog so it selects one compatible version per app, republish it, then reload the page.',
      retryable: false,
    });
    this.name = 'AtlasCatalogSelectionError';
  }
}

export class AtlasOverrideError extends AtlasRuntimeError {
  constructor(summary: string, cause?: unknown) {
    super(summary, {
      code: 'ATLAS_INVALID_OVERRIDE',
      suggestedActions:
        'Open Columbus, correct or disable the affected override, then reload the host page.',
      ...(cause !== undefined ? { cause } : {}),
      retryable: false,
    });
    this.name = 'AtlasOverrideError';
  }
}

export class AtlasRemoteTrustError extends AtlasRuntimeError {
  constructor(summary: string) {
    super(summary, {
      code: 'ATLAS_REMOTE_TRUST_REJECTED',
      suggestedActions:
        'Correct the app manifest URL, allowed origin, or integrity value; rebuild and republish the app, then reload.',
      retryable: false,
    });
    this.name = 'AtlasRemoteTrustError';
  }
}

export class AtlasCatalogHostMismatchError extends AtlasRuntimeError {
  constructor(input: { catalogHostId: string; configuredHostId: string }) {
    super(
      `Atlas cannot start host "${input.configuredHostId}" because its catalog belongs to host "${input.catalogHostId}".`,
      {
        code: 'ATLAS_CATALOG_HOST_MISMATCH',
        suggestedActions: `Point manifestUrl to the deployment for host "${input.configuredHostId}", or correct the configured hostId, then reload the page.`,
        retryable: false,
      },
    );
    this.name = 'AtlasCatalogHostMismatchError';
  }
}

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429]);

export class AtlasResourceHttpError extends AtlasRuntimeError {
  constructor(input: { url: string; status: number; statusText: string }) {
    const status = [input.status, input.statusText].filter(Boolean).join(' ');
    super(`Atlas could not download "${input.url}": HTTP ${status}.`, {
      code: 'ATLAS_RESOURCE_HTTP_ERROR',
      suggestedActions:
        'Verify the URL is deployed, reachable, and permits the host origin through CORS, then retry.',
      retryable:
        input.status >= 500 || RETRYABLE_HTTP_STATUSES.has(input.status),
    });
    this.name = 'AtlasResourceHttpError';
  }
}

export class AtlasAppMountExportMissingError extends AtlasRuntimeError {
  constructor(appId: string) {
    super(
      `Atlas cannot mount app "${appId}" because its remote module does not export mount(request).`,
      {
        code: 'ATLAS_APP_MOUNT_EXPORT_MISSING',
        suggestedActions:
          'Export the Atlas app lifecycle entry from the configured federation expose, rebuild the app, and republish it.',
        retryable: false,
      },
    );
    this.name = 'AtlasAppMountExportMissingError';
  }
}

export class AtlasWidgetMountExportMissingError extends AtlasRuntimeError {
  constructor(widgetReference: string) {
    super(
      `Atlas cannot mount exported widget "${widgetReference}" because its remote module does not export mount(request).`,
      {
        code: 'ATLAS_WIDGET_MOUNT_EXPORT_MISSING',
        suggestedActions:
          'Regenerate or correct the widget federation expose, rebuild its owner app, and republish it.',
        retryable: false,
      },
    );
    this.name = 'AtlasWidgetMountExportMissingError';
  }
}

export class AtlasWidgetOwnerUntrustedError extends AtlasRuntimeError {
  constructor(input: { widgetId: string; ownerAppId: string }) {
    super(
      `Atlas cannot load widget "${input.widgetId}" because owner app "${input.ownerAppId}" is not trusted by this host.`,
      {
        code: 'ATLAS_WIDGET_OWNER_UNTRUSTED',
        suggestedActions: `Add app "${input.ownerAppId}" to the host catalog or registry, then reload the page.`,
        retryable: false,
      },
    );
    this.name = 'AtlasWidgetOwnerUntrustedError';
  }
}

export class AtlasWidgetOwnerMismatchError extends AtlasRuntimeError {
  constructor(input: { widgetId: string; ownerAppId: string }) {
    super(
      `Atlas cannot load widget "${input.widgetId}" because its owner manifest does not match app "${input.ownerAppId}".`,
      {
        code: 'ATLAS_WIDGET_OWNER_MISMATCH',
        suggestedActions:
          'Correct the widget ownerAppId or registry manifest, then republish the owning app.',
        retryable: false,
      },
    );
    this.name = 'AtlasWidgetOwnerMismatchError';
  }
}

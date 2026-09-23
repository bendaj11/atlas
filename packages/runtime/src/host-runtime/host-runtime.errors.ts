import { AtlasBrowserError } from '../shared/errors.js';

export class AtlasRouteReconciliationError extends AtlasBrowserError {
  constructor(cause: unknown) {
    super(cause, {
      summary: 'Atlas could not update the active route',
      suggestedActions: [
        'Verify the route placement and app mount lifecycle named in the error details.',
        'Correct the host or app route configuration, then navigate again.',
      ],
      code: 'ATLAS_ROUTE_RECONCILIATION_FAILED',
    });
    this.name = 'AtlasRouteReconciliationError';
  }
}

export class AtlasDuplicateRouteError extends AtlasBrowserError {
  constructor(input: { hostId: string; path: string; appId: string }) {
    super(
      new Error(
        `Host "${input.hostId}" already has an app assigned to route "${input.path}", so app "${input.appId}" was not mounted there.`,
      ),
      {
        summary: 'Atlas found two apps assigned to the same host route',
        suggestedActions: [
          `Give route "${input.path}" to only one app for host "${input.hostId}".`,
          'Update atlas.config.ts in the conflicting app, rebuild it, and republish its manifest.',
        ],
        code: 'ATLAS_DUPLICATE_ROUTE',
      },
    );
    this.name = 'AtlasDuplicateRouteError';
  }
}

import { AtlasRuntimeError } from '../shared/errors.js';

export class AtlasAppRouteNotFoundError extends AtlasRuntimeError {
  constructor(appId: string) {
    super(
      `Atlas cannot navigate to "${appId}" because it has no navigation target in this host.`,
      {
        code: 'ATLAS_APP_ROUTE_NOT_FOUND',
        suggestedActions:
          'Use an id selected by this host that declares an app route or headless app path.',
        retryable: false,
      },
    );
    this.name = 'AtlasAppRouteNotFoundError';
  }
}

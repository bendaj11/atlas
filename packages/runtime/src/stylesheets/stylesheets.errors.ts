import { AtlasRuntimeError } from '../shared/errors.js';

export class AtlasStylesheetLoadError extends AtlasRuntimeError {
  constructor(input: { appId: string; href: string }) {
    super(
      `Atlas could not load stylesheet for app "${input.appId}": ${input.href}`,
      {
        code: 'ATLAS_STYLESHEET_LOAD_FAILED',
        suggestedActions:
          'Verify the stylesheet URL is deployed, reachable, and permits the host origin through CORS, then retry.',
      },
    );
    this.name = 'AtlasStylesheetLoadError';
  }
}

export class AtlasStylesheetAdaptError extends AtlasRuntimeError {
  constructor(input: { appId: string; href: string; cause: unknown }) {
    super(
      `Atlas could not adapt stylesheet for app "${input.appId}": ${input.href}.`,
      {
        code: 'ATLAS_STYLESHEET_ADAPT_FAILED',
        suggestedActions:
          'Ensure this stylesheet and its CSS imports allow CORS from the host origin, then reload.',
        cause: input.cause,
      },
    );
    this.name = 'AtlasStylesheetAdaptError';
  }
}

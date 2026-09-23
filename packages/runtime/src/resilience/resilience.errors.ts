import { AtlasError } from '@atlas/schema';
import { AtlasRuntimeError, extractErrorMessage } from '../shared/errors.js';
import type { AtlasOperationContext } from './resilience.types.js';

export class AtlasLoadError extends AtlasError {
  readonly stage: string;
  readonly resource: string | undefined;
  readonly appId: string | undefined;
  readonly version: string | undefined;
  readonly attempts: number;

  constructor(input: {
    context: AtlasOperationContext;
    attempts: number;
    cause: unknown;
  }) {
    const { context, attempts, cause } = input;
    const details = [
      `stage=${context.stage}`,
      context.appId ? `app=${context.appId}` : undefined,
      context.version ? `version=${context.version}` : undefined,
      context.resource ? `resource=${context.resource}` : undefined,
      `attempts=${attempts}`,
    ]
      .filter(Boolean)
      .join(', ');
    super(
      `Atlas could not load a required resource (${details}): ${extractErrorMessage(cause)}`,
      {
        suggestedActions: suggestedActionsForFailedStage(context.stage, cause),
        cause,
        code: 'ATLAS_RESOURCE_LOAD_FAILED',
        surface: 'browser',
      },
    );
    this.name = 'AtlasLoadError';
    this.stage = context.stage;
    this.resource = context.resource;
    this.appId = context.appId;
    this.version = context.version;
    this.attempts = attempts;
  }
}

function suggestedActionsForFailedStage(
  stage: string,
  cause: unknown,
): string | readonly string[] {
  if (cause instanceof AtlasError && cause.suggestedActions.length)
    return cause.suggestedActions;

  if (stage === 'catalog' || stage === 'manifest')
    return 'Verify the manifest URL, response status, JSON schema, and network access, then retry.';

  if (
    stage.includes('remote') ||
    stage.includes('federation') ||
    stage.includes('widget')
  ) {
    return 'Verify app artifact URL, deployment, CORS policy, and federation metadata, then retry.';
  }

  return `Verify resource used during "${stage}" is reachable and correctly configured, then retry.`;
}

export class AtlasInvalidTimeoutError extends AtlasRuntimeError {
  constructor(timeoutMs: number) {
    super(
      `Atlas request timeoutMs must be a positive integer; received ${timeoutMs}.`,
      {
        code: 'ATLAS_INVALID_TIMEOUT',
        suggestedActions:
          'Set resourcesTimeoutMs to an integer greater than zero in the host runtime configuration.',
        retryable: false,
      },
    );
    this.name = 'AtlasInvalidTimeoutError';
  }
}

export class AtlasInvalidRetryCountError extends AtlasRuntimeError {
  constructor(retryCount: number) {
    super(
      `Atlas retryCount must be a non-negative integer; received ${retryCount}.`,
      {
        code: 'ATLAS_INVALID_RETRY_COUNT',
        suggestedActions:
          'Set resourcesRetryCount to zero or a positive integer in the host runtime configuration.',
        retryable: false,
      },
    );
    this.name = 'AtlasInvalidRetryCountError';
  }
}

export class AtlasRetryStateError extends AtlasRuntimeError {
  constructor() {
    super(
      'Atlas stopped retrying without completing or reporting the resource request.',
      {
        code: 'ATLAS_RETRY_STATE_INVALID',
        suggestedActions:
          'Capture this error and report it as an Atlas runtime defect; include the operation events and preserved stack trace.',
      },
    );
    this.name = 'AtlasRetryStateError';
  }
}

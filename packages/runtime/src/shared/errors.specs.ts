import { faker } from '@faker-js/faker';
import { AtlasError } from '@atlas/schema';
import {
  AtlasBrowserError,
  AtlasRuntimeError,
  isRetryableFailure,
} from './errors.js';

const CONTEXT = {
  summary: 'Atlas could not mount app',
  suggestedActions: ['Fix the app.'],
  code: 'ATLAS_APP_MOUNT_FAILED',
};

describe('AtlasBrowserError', () => {
  it('should wrap a plain error with the context code when the failure is not an AtlasError', () => {
    expect(new AtlasBrowserError(new Error('boom'), CONTEXT)).toMatchObject({
      code: 'ATLAS_APP_MOUNT_FAILED',
      suggestedActions: ['Fix the app.'],
      summary: 'Atlas could not mount app: boom',
    });
  });

  it('should wrap a non-error value with the context summary when the failure is a string', () => {
    const value = faker.lorem.word();

    expect(new AtlasBrowserError(value, CONTEXT).summary).toBe(
      `Atlas could not mount app: ${value}`,
    );
  });

  it('should keep the inner code and suggested actions when the failure is an AtlasError', () => {
    const inner = new AtlasError('Remote rejected', {
      suggestedActions: 'Allow the origin.',
      code: 'ATLAS_REMOTE_TRUST_REJECTED',
    });

    expect(new AtlasBrowserError(inner, CONTEXT)).toMatchObject({
      code: 'ATLAS_REMOTE_TRUST_REJECTED',
      suggestedActions: ['Allow the origin.'],
      summary: 'Atlas could not mount app: Remote rejected',
      cause: inner,
    });
  });

  it('should fall back to the context code when the inner AtlasError has no code', () => {
    const inner = new AtlasError('Remote rejected', {
      suggestedActions: 'Allow the origin.',
    });

    expect(new AtlasBrowserError(inner, CONTEXT).code).toBe(
      'ATLAS_APP_MOUNT_FAILED',
    );
  });
});

describe('isRetryableFailure', () => {
  it('should return true when the failure is a plain error', () => {
    expect(isRetryableFailure(new Error('boom'))).toBe(true);
  });

  it('should return true when the runtime error does not opt out of retries', () => {
    expect(
      isRetryableFailure(
        new AtlasRuntimeError('boom', { suggestedActions: 'x', code: 'X' }),
      ),
    ).toBe(true);
  });

  it('should return false when the runtime error opts out of retries', () => {
    expect(
      isRetryableFailure(
        new AtlasRuntimeError('boom', {
          suggestedActions: 'x',
          code: 'X',
          retryable: false,
        }),
      ),
    ).toBe(false);
  });
});

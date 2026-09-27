import { isDevelopmentOfferIds } from '@atlas/schema';
import type { DevSession } from '../overrides.types.js';

export function isDevelopmentSession(value: unknown): value is DevSession {
  if (!isObject(value)) return false;

  return (
    isOptional(value.hostId, (hostId) => typeof hostId === 'string') &&
    isOptional(value.overrides, Array.isArray) &&
    isOptional(value.hostOverride, isObject) &&
    isOptional(value.catalog, isObject) &&
    isOptional(value.offerIds, isDevelopmentOfferIds)
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptional(
  value: unknown,
  isValid: (candidate: unknown) => boolean,
): boolean {
  return value === undefined || isValid(value);
}

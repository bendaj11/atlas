import { faker } from '@faker-js/faker';
import type { BootstrapFailure } from '../browser/fatal-error/fatal-error.types.js';

export function aBootstrapFailure(
  overrides: Partial<BootstrapFailure> = {},
): BootstrapFailure {
  return {
    message: faker.lorem.sentence(),
    suggestedActions: [faker.lorem.sentence(), faker.lorem.sentence()],
    code: faker.string.alpha({ length: 8, casing: 'upper' }),
    cause: new Error(faker.lorem.sentence()),
    ...overrides,
  };
}

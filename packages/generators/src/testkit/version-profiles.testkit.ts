import { faker } from '@faker-js/faker';
import type {
  AngularVersionProfile,
  ReactVersionProfile,
} from '../cli/generator-versions.js';

export function aSemver(major = faker.number.int({ min: 1, max: 30 })): string {
  return `${major}.${faker.number.int({ min: 0, max: 20 })}.${faker.number.int({ min: 0, max: 20 })}`;
}

export function anAngularVersionProfile(
  overrides: Partial<AngularVersionProfile> = {},
): AngularVersionProfile {
  const major = overrides.major ?? faker.number.int({ min: 15, max: 25 });

  return {
    major,
    version: aSemver(major),
    typescript: `>=${aSemver()} <${aSemver()}`,
    zone: `^${aSemver(0)}`,
    zoneless: faker.datatype.boolean(),
    requiresZonelessProvider: faker.datatype.boolean(),
    ...overrides,
  };
}

export function aReactVersionProfile(
  overrides: Partial<ReactVersionProfile> = {},
): ReactVersionProfile {
  const major = overrides.major ?? faker.number.int({ min: 15, max: 21 });

  return {
    major,
    version: aSemver(major),
    routerVersion: `^${aSemver()}`,
    ...overrides,
  };
}

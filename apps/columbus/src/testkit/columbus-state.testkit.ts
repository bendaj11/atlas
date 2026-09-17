import { faker } from '@faker-js/faker';
import type { ColumbusState, Scope } from './columbus-state';
import { aHostData } from './host-data.testkit';

const SCOPES: Scope[] = ['all', 'tab'];

export function aColumbusState(
  overrides: Partial<ColumbusState> = {},
): ColumbusState {
  return {
    hostData: aHostData(),
    tabId: faker.number.int({ min: 1, max: 1000 }),
    enabledArtifactVersionOverrides: new Map(),
    disabledArtifactVersionOverrides: new Map(),
    clearedLocalArtifactIds: new Set(),
    scope: faker.helpers.arrayElement(SCOPES),
    ...overrides,
  };
}

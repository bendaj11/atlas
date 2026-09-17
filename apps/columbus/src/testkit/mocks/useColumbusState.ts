import { jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';
import type { useColumbusState as useColumbusStateType } from '../../hooks/useColumbusState/useColumbusState';

export const useColumbusStateMock: jest.Mock<typeof useColumbusStateType> =
  jest.fn();

jest.unstable_mockModule(
  fileURLToPath(
    new URL('../../hooks/useColumbusState/useColumbusState', import.meta.url),
  ),
  () => ({ useColumbusState: useColumbusStateMock }),
);
